import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MODEL } from "@/lib/anthropic";
import { TailorRequest, TailorResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOOL_NAME = "submit_tailored_resume";

const SYSTEM_PROMPT = `You are an expert resume writer and career coach with deep experience in ATS (Applicant Tracking System) optimization and technical/professional recruiting.

Given a candidate's existing resume and a target job description, rewrite the resume to align as closely as truthfully possible with the job description, and produce it as PLAIN TEXT following this EXACT structure and line order — it will be parsed programmatically, so the structure must be followed precisely:

Line 1: Candidate's full name (exactly as in the original resume)
Line 2: Candidate's professional title(s), exactly as in the original resume or lightly adjusted to match the target role
Line 3: Contact line — phone, email, location, separated by " | " exactly, e.g. "(555) 123-4567 | name@email.com | City, ST"
Line 4: LinkedIn URL, if the original resume has one (omit this line entirely if the original has no LinkedIn URL)
(blank line)
SUMMARY
[2-3 sentence tailored summary paragraph. Wrap the 3-5 most JD-relevant skills/technologies mentioned in it with **double asterisks** to bold them, e.g. "...expertise in **Generative AI** and **cloud-native infrastructure**..."]
(blank line)
WORK EXPERIENCE
[Job Title], [Company]
[Start Date] - [End Date or Present] | [Location]
[One-sentence company/mission description, if present in the original]
- [bullet tailored to the job description — wrap 1-3 of the most JD-relevant terms per bullet in **double asterisks**, e.g. "Built **RAG pipelines** using **Pinecone** and **FAISS** to power semantic search."]
- [bullet]
- [bullet]
(blank line between each job entry, most recent first)
(blank line)
SKILLS
[Category Name]
[comma-separated items for that category, on their own line]
[Category Name]
[comma-separated items for that category, on their own line]
(repeat as needed — category name and its items must alternate on separate lines, never combined with a colon)
(blank line)
EDUCATION
[Degree], [School]
[Start Date] - [End Date] | [Location]
[Activities line, separated by " · ", if present in the original]

MAXIMIZING GENUINE ALIGNMENT:
- Read the job description closely and find every real point of overlap with the candidate's actual background, no matter how minor or implicit — do not leave any truthful overlap unmirrored.
- Wherever the candidate's real experience supports it, use the job description's exact terminology and phrasing (not just a synonym), since ATS systems and recruiters weight exact keyword matches heavily.
- Reorder and re-emphasize bullets so the most JD-relevant, truthful experience appears first in each role.
- If the job description asks for something the candidate has adjacent-but-not-exact experience with (e.g. a similar tool, a related methodology), it is acceptable to state the adjacent truth using JD-aligned language — but claim the exact tool, certification, or exact years of experience if the candidate does not have it.

STRICT RULES (never violate, even to raise the match further):
- Never invent employers, titles, dates, degrees, certifications, or achievements not present in the original resume.
- You can claim a specific technology, tool, or skill that does not appear anywhere in the original resume but appears in the Job description.
- Never alter dates or seniority to imply more experience than the original resume shows.
- MATCH THE ORIGINAL'S LENGTH AND DETAIL: include every role from the original resume, and preserve roughly the same number of bullets per role as the original (do not compress, drop, or shorten roles/bullets purely for the sake of brevity). If the original resume runs 2-3 pages of content, the tailored version should too — do not artificially truncate it.
- Each bullet should still read as tight, substantive, single-sentence — but do not cut bullets just to save space.
- Quantify impact wherever the original text allows it.
- Do not add markdown formatting other than the **bold** keyword markers described above (no #, no single *, no markdown headers or lists) — plain text only, matching the structure above exactly. Use "•" for bullets, not "-" or "*".

You will also separately: compute a match score (0-100) for how well the ORIGINAL resume aligned with the job description before your edits; list keywords from the job description already present vs. genuinely missing in the original (missingKeywords should list anything you could NOT truthfully add, so the candidate knows what to address elsewhere, e.g. in the cover letter or in future skill-building); list concrete changes you made; and draft a tailored 3-4 paragraph cover letter that can speak to genuine strengths and can briefly and honestly address how the candidate's adjacent experience relates to any gaps.`;

const inputSchema = {
  type: "object" as const,
  properties: {
    tailoredResume: {
      type: "string",
      description:
        "The full rewritten resume as clean plain text, using clear section headers (e.g. SUMMARY, EXPERIENCE, EDUCATION, SKILLS) and bullet points starting with '- '.",
    },
    matchScore: {
      type: "number",
      description: "0-100 score of how well the ORIGINAL resume matched the job description.",
    },
    matchedKeywords: {
      type: "array",
      items: { type: "string" },
      description: "Important keywords/skills from the job description already present in the original resume.",
    },
    missingKeywords: {
      type: "array",
      items: { type: "string" },
      description: "Important keywords/skills from the job description absent from the original resume.",
    },
    summaryOfChanges: {
      type: "array",
      items: { type: "string" },
      description: "Short bullet points describing what was changed and why.",
    },
    coverLetter: {
      type: "string",
      description: "A tailored cover letter, plain text, 3-4 paragraphs, no placeholders left unfilled other than [Company Name] or [Your Name] if truly unknown.",
    },
  },
  required: [
    "tailoredResume",
    "matchScore",
    "matchedKeywords",
    "missingKeywords",
    "summaryOfChanges",
    "coverLetter",
  ],
};

// Claude's tool-call output usually matches the schema exactly, but models can
// occasionally return a string instead of an array, omit a field, or send a
// number as a string. These helpers guarantee the shape the frontend expects
// no matter what comes back, so a minor model deviation never crashes the UI.
function toStringArraySafe(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter((v) => v.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    // Model sometimes returns a comma or newline separated string instead of an array.
    return value
      .split(/,|\n/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function toStringSafe(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function toScoreSafe(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TailorRequest;
    const { resumeText, jobDescription, companyName, applicantName } = body;

    if (!resumeText?.trim() || !jobDescription?.trim()) {
      return NextResponse.json(
        { error: "Both resumeText and jobDescription are required." },
        { status: 400 }
      );
    }

    const anthropic = getAnthropicClient();

    const userContent = `CANDIDATE'S CURRENT RESUME:
"""
${resumeText}
"""

TARGET JOB DESCRIPTION:
"""
${jobDescription}
"""
${companyName ? `\nCompany name: ${companyName}` : ""}
${applicantName ? `Applicant name: ${applicantName}` : ""}

Tailor the resume and produce the cover letter now, using the submit_tailored_resume tool.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      // Cap left at 8000 on purpose — you're only ever billed for tokens
      // actually generated, so this doesn't add cost. Lowering it below what
      // a long, multi-page resume needs would just truncate output.
      max_tokens: 8000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Static across every request, so caching it means only the first
          // call in a ~5-min window pays full input price for these tokens;
          // every call after that pays roughly 10% of that for this block.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
      tools: [
        {
          name: TOOL_NAME,
          description: "Submit the tailored resume, match analysis, and cover letter.",
          input_schema: inputSchema,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolUse) {
      return NextResponse.json(
        { error: "Model did not return structured output." },
        { status: 502 }
      );
    }

    const raw = toolUse.input as Record<string, unknown>;
    const result: TailorResult = {
      tailoredResume: toStringSafe(raw.tailoredResume),
      matchScore: toScoreSafe(raw.matchScore),
      matchedKeywords: toStringArraySafe(raw.matchedKeywords),
      missingKeywords: toStringArraySafe(raw.missingKeywords),
      summaryOfChanges: toStringArraySafe(raw.summaryOfChanges),
      coverLetter: toStringSafe(raw.coverLetter),
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Tailor API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error occurred." },
      { status: 500 }
    );
  }
}