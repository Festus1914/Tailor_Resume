import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/anthropic";
import type { ResumeDocument } from "@/lib/types";
import { requireUser } from "@/lib/auth/guards";
import { badRequest, toErrorResponse } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const PARSE_PROMPT = `You are an expert resume parser. Analyze the provided resume/CV text and extract all information into a structured JSON format.

Extract the following structure (return ONLY valid JSON, no markdown, no explanation):
{
  "header": {
    "fullName": "string",
    "headline": "string (job title or professional headline)",
    "email": "string",
    "phone": "string",
    "location": "string",
    "links": [
      {"label": "string (e.g., LinkedIn, GitHub)", "url": "string"}
    ]
  },
  "summary": "string (professional summary or objective)",
  "experience": [
    {
      "company": "string",
      "title": "string",
      "location": "string",
      "startDate": "string (e.g., 01/2020, Jan 2020, 2020)",
      "endDate": "string (e.g., Present, 12/2023, Dec 2023)",
      "isCurrent": boolean,
      "companyDescription": "string (optional company description)",
      "bullets": ["string", "string", "..."]
    }
  ],
  "skills": [
    {
      "label": "string (e.g., Languages, Tools, Frameworks)",
      "items": ["skill1", "skill2", "..."]
    }
  ],
  "education": [
    {
      "school": "string",
      "degree": "string",
      "field": "string",
      "startDate": "string",
      "endDate": "string",
      "location": "string",
      "activities": ["string"]
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "date": "string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "bullets": ["string"],
      "url": "string"
    }
  ]
}

IMPORTANT:
- Extract ONLY information that is explicitly in the resume
- For dates, use the format shown in the original resume (e.g., "01/2020", "Jan 2020")
- If a field is not present in the resume, use empty string for strings, empty array for arrays, false for booleans
- Do not invent or assume information
- Return valid JSON only`;

/**
 * Extract text from uploaded resume file (PDF, DOCX, or TXT)
 */
async function extractTextFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  if (file.type === "text/plain") {
    // Plain text file
    const text = new TextDecoder().decode(buffer);
    return text.trim();
  } else if (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  ) {
    // PDF file
    try {
      // @ts-ignore - dynamic require
      const pdfParse = require("pdf-parse/lib/pdf.js");
      const data = await pdfParse(Buffer.from(buffer));
      return data.text.trim();
    } catch (e) {
      throw new Error(`Failed to parse PDF: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  } else if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    // DOCX file
    return new Promise((resolve, reject) => {
      try {
        // @ts-ignore - dynamic require
        const DocxParser = require("docx-parser");
        const parser = new DocxParser();
        parser.parseBuffer(Buffer.from(buffer), (err: any, data: any) => {
          if (err) {
            reject(new Error(`Failed to parse DOCX: ${err.message || err}`));
          } else {
            const text = data?.fullText || data?.text || "";
            resolve(text.trim());
          }
        });
      } catch (e) {
        reject(new Error(`Error initializing DOCX parser: ${e instanceof Error ? e.message : "Unknown error"}`));
      }
    });
  } else {
    throw new Error(
      `Unsupported file type: ${file.type || file.name}. Supported formats: PDF, DOCX, TXT`
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      throw badRequest("No file provided");
    }

    console.log("[PARSE_CV] Parsing file:", { name: file.name, type: file.type, size: file.size });

    // Extract text from file based on type
    const resumeText = await extractTextFromFile(file);

    if (!resumeText || resumeText.trim().length < 50) {
      throw badRequest(
        "Resume text is too short or empty. Please provide a valid resume."
      );
    }

    console.log("[PARSE_CV] Extracted text length:", resumeText.length);

    // Parse the resume using Claude
    const client = getAnthropicClient();
    const parseResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `${PARSE_PROMPT}\n\nResume text:\n\n${resumeText}`,
        },
      ],
    });

    const responseText = parseResponse.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");

    // Extract JSON from response (in case there's markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw badRequest("Failed to parse resume - could not extract JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]) as ResumeDocument;

    return NextResponse.json({
      success: true,
      data: parsed,
      rawText: resumeText,
    });
  } catch (error) {
    console.error("CV parse error:", error);
    if (error instanceof SyntaxError) {
      return toErrorResponse(badRequest("Invalid resume format or structure"));
    }
    return toErrorResponse(error);
  }
}
