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
  console.log("[EXTRACT] Starting extraction for file:", { name: file.name, type: file.type });

  try {
    const buffer = await file.arrayBuffer();
    console.log("[EXTRACT] Buffer size:", buffer.byteLength);

    if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      // Plain text file
      console.log("[EXTRACT] Processing as text file");
      const text = new TextDecoder().decode(buffer);
      const trimmed = text.trim();
      console.log("[EXTRACT] Text extracted, length:", trimmed.length);
      return trimmed;
    } else if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      // PDF file
      console.log("[EXTRACT] Processing as PDF file");
      try {
        // @ts-ignore - dynamic require
        const pdfjs = require("pdfjs-dist/legacy/build/pdf");
        console.log("[EXTRACT] pdfjs-dist loaded successfully");

        const pdfData = new Uint8Array(buffer);
        const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
        console.log("[EXTRACT] PDF loaded, pages:", pdf.numPages);

        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          fullText += pageText + "\n";
        }

        const text = fullText.trim();
        console.log("[EXTRACT] PDF text extracted, length:", text.length);
        return text;
      } catch (e) {
        console.error("[EXTRACT] PDF parsing error:", e);
        throw new Error(`Failed to parse PDF: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    } else if (
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      // DOCX file
      console.log("[EXTRACT] Processing as DOCX file");
      return new Promise((resolve, reject) => {
        try {
          // @ts-ignore - dynamic require
          const DocxParser = require("docx-parser");
          console.log("[EXTRACT] docx-parser loaded successfully");
          const parser = new DocxParser();
          parser.parseBuffer(Buffer.from(buffer), (err: any, data: any) => {
            if (err) {
              console.error("[EXTRACT] DOCX parse error:", err);
              reject(new Error(`Failed to parse DOCX: ${err.message || err}`));
            } else {
              const text = data?.fullText || data?.text || "";
              const trimmed = text.trim();
              console.log("[EXTRACT] DOCX text extracted, length:", trimmed.length);
              resolve(trimmed);
            }
          });
        } catch (e) {
          console.error("[EXTRACT] DOCX initialization error:", e);
          reject(new Error(`Error initializing DOCX parser: ${e instanceof Error ? e.message : "Unknown error"}`));
        }
      });
    } else {
      console.error("[EXTRACT] Unsupported file type:", { type: file.type, name: file.name });
      throw new Error(
        `Unsupported file type: ${file.type || file.name}. Supported formats: PDF, DOCX, TXT`
      );
    }
  } catch (error) {
    console.error("[EXTRACT] Extraction failed:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.error("[PARSE_CV] No file provided");
      throw badRequest("No file provided");
    }

    console.log("[PARSE_CV] Starting file parse:", { name: file.name, type: file.type, size: file.size });

    // Extract text from file based on type
    let resumeText: string;
    try {
      resumeText = await extractTextFromFile(file);
      console.log("[PARSE_CV] Successfully extracted text, length:", resumeText.length);
    } catch (extractError) {
      console.error("[PARSE_CV] Text extraction failed:", extractError);
      throw badRequest(
        extractError instanceof Error ? extractError.message : "Failed to extract text from file"
      );
    }

    if (!resumeText || resumeText.trim().length < 50) {
      console.error("[PARSE_CV] Resume text too short:", resumeText.length);
      throw badRequest(
        "Resume text is too short or empty. Please provide a valid resume."
      );
    }

    console.log("[PARSE_CV] Extracted text length:", resumeText.length);

    // Parse the resume using Claude
    console.log("[PARSE_CV] Calling Claude API to parse resume");
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

    console.log("[PARSE_CV] Claude response length:", responseText.length);

    // Extract JSON from response (in case there's markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[PARSE_CV] Could not extract JSON from response");
      throw badRequest("Failed to parse resume - could not extract JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]) as ResumeDocument;
    console.log("[PARSE_CV] Successfully parsed resume structure");

    return NextResponse.json({
      success: true,
      data: parsed,
      rawText: resumeText,
    });
  } catch (error) {
    console.error("[PARSE_CV] Error:", error instanceof Error ? error.message : String(error));
    console.error("[PARSE_CV] Full error:", error);
    if (error instanceof SyntaxError) {
      return toErrorResponse(badRequest("Invalid resume format or structure"));
    }
    return toErrorResponse(error);
  }
}
