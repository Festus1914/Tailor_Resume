import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedJobData } from "./advanced-extractor";

/**
 * Resume Builder - Generates tailored resume from master resume and job data
 */

export interface ResumeContent {
  text: string;
  sections: {
    header?: string;
    summary?: string;
    experience?: string[];
    skills?: string[];
    education?: string[];
  };
}

const client = new Anthropic();

/**
 * Build tailored resume using Claude
 */
export async function buildTailoredResume(
  masterResume: string,
  jobData: ExtractedJobData
): Promise<ResumeContent> {
  try {
    console.log("[RESUME] Building tailored resume");

    const prompt = `You are an expert resume writer. Tailor this resume to match the job posting.

MASTER RESUME:
${masterResume}

JOB POSTING:
Title: ${jobData.title}
Company: ${jobData.company}
Requirements: ${jobData.requirements.join(", ")}
Description: ${jobData.description.substring(0, 1000)}

Your task:
1. Keep the resume structure intact
2. Emphasize skills matching job requirements
3. Reorder experience to highlight relevant roles
4. Update technical skills section with job-matching keywords
5. Keep everything truthful - don't fabricate

Return ONLY the tailored resume text (plain text, no JSON).`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";

    if (!text || text.length < 100) {
      throw new Error("Resume generation failed");
    }

    console.log("[RESUME] Generated resume:", text.length, "characters");

    return {
      text: text.trim(),
      sections: parseResumeSections(text),
    };
  } catch (error) {
    console.error("[RESUME] Error building resume:", error);
    throw error;
  }
}

/**
 * Parse resume into sections
 */
function parseResumeSections(resume: string): ResumeContent["sections"] {
  const sections: ResumeContent["sections"] = {};

  const lines = resume.split("\n");
  let currentSection = "";

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (
      upper.includes("SUMMARY") ||
      upper.includes("OBJECTIVE") ||
      upper.includes("PROFESSIONAL")
    ) {
      currentSection = "summary";
      sections.summary = "";
    } else if (upper.includes("EXPERIENCE") || upper.includes("WORK")) {
      currentSection = "experience";
      sections.experience = [];
    } else if (upper.includes("SKILL")) {
      currentSection = "skills";
      sections.skills = [];
    } else if (upper.includes("EDUCATION")) {
      currentSection = "education";
      sections.education = [];
    } else if (line.trim()) {
      if (currentSection === "summary") {
        sections.summary = (sections.summary || "") + line + "\n";
      } else if (currentSection === "experience" && sections.experience) {
        sections.experience.push(line);
      } else if (currentSection === "skills" && sections.skills) {
        if (line.includes(",") || line.includes(";")) {
          sections.skills.push(...line.split(/[,;]/));
        } else {
          sections.skills.push(line);
        }
      } else if (currentSection === "education" && sections.education) {
        sections.education.push(line);
      }
    }
  }

  return sections;
}

/**
 * Extract plain text from resume
 */
export function extractResumeText(resume: string): string {
  return resume
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Validate resume content
 */
export function validateResumeContent(content: string): boolean {
  const minLength = 100;
  const minLines = 5;

  if (!content || content.length < minLength) return false;
  if (content.split("\n").length < minLines) return false;

  // Check for common resume keywords
  const keywords = ["experience", "skill", "education", "contact"];
  const hasKeywords = keywords.some((kw) =>
    content.toLowerCase().includes(kw)
  );

  return hasKeywords;
}
