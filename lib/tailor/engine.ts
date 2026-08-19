import { Anthropic } from "@anthropic-ai/sdk";
import type { ResumeDocument, MatchAnalysis } from "@/lib/types";
import type { IJob } from "@/lib/models";

/**
 * Resume tailoring engine using Claude.
 *
 * Takes a master resume and job posting, generates a tailored version
 * optimized for the specific role, plus a cover letter and match analysis.
 */

const client = new Anthropic();

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export interface TailoringResult {
  resume: ResumeDocument;
  coverLetter: string;
  analysis: MatchAnalysis;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
}

/**
 * Formats a resume document as plain text for the prompt.
 */
function formatResumeForPrompt(resume: ResumeDocument): string {
  let text = "";

  // Header
  if (resume.header.fullName || resume.header.headline) {
    text += `${resume.header.fullName}\n`;
    if (resume.header.headline) text += `${resume.header.headline}\n`;
    text += "\n";
  }

  if (resume.header.email || resume.header.phone || resume.header.location) {
    text += [resume.header.email, resume.header.phone, resume.header.location]
      .filter(Boolean)
      .join(" | ");
    text += "\n\n";
  }

  // Summary
  if (resume.summary) {
    text += "PROFESSIONAL SUMMARY\n";
    text += resume.summary + "\n\n";
  }

  // Experience
  if (resume.experience.length > 0) {
    text += "EXPERIENCE\n";
    resume.experience.forEach((exp) => {
      text += `${exp.title} at ${exp.company}`;
      if (exp.location) text += ` (${exp.location})`;
      text += "\n";
      text += `${exp.startDate} - ${exp.isCurrent ? "Present" : exp.endDate}\n`;
      if (exp.companyDescription) text += `${exp.companyDescription}\n`;
      exp.bullets.forEach((bullet) => {
        text += `• ${bullet}\n`;
      });
      text += "\n";
    });
  }

  // Skills
  if (resume.skills.length > 0) {
    text += "SKILLS\n";
    resume.skills.forEach((group) => {
      if (group.label) text += `${group.label}: `;
      text += group.items.join(", ") + "\n";
    });
    text += "\n";
  }

  // Education
  if (resume.education.length > 0) {
    text += "EDUCATION\n";
    resume.education.forEach((edu) => {
      text += `${edu.degree} in ${edu.field} from ${edu.school}\n`;
      if (edu.location) text += `${edu.location}\n`;
      if (edu.activities.length > 0) {
        text += `Activities: ${edu.activities.join(", ")}\n`;
      }
      text += "\n";
    });
  }

  // Certifications
  if (resume.certifications.length > 0) {
    text += "CERTIFICATIONS\n";
    resume.certifications.forEach((cert) => {
      text += `${cert.name} - ${cert.issuer} (${cert.date})\n`;
    });
    text += "\n";
  }

  // Projects
  if (resume.projects.length > 0) {
    text += "PROJECTS\n";
    resume.projects.forEach((proj) => {
      text += `${proj.name}\n`;
      if (proj.description) text += `${proj.description}\n`;
      proj.bullets.forEach((bullet) => {
        text += `• ${bullet}\n`;
      });
      if (proj.url) text += `${proj.url}\n`;
      text += "\n";
    });
  }

  return text;
}

/**
 * Formats a job posting for the prompt.
 */
function formatJobForPrompt(job: IJob): string {
  return `
POSITION: ${job.title}
COMPANY: ${job.company}
LOCATION: ${job.location}
TYPE: ${job.employmentType}

DESCRIPTION:
${job.descriptionText}

REQUIREMENTS:
${job.requirements.map((r) => `• ${r}`).join("\n")}
`;
}


/**
 * Generates a tailored resume and cover letter for a job posting.
 */
export async function tailorResume(
  masterResume: ResumeDocument,
  job: IJob
): Promise<TailoringResult> {
  const resumeText = formatResumeForPrompt(masterResume);
  const jobText = formatJobForPrompt(job);

  const systemPrompt = `You are an expert resume writer, professional recruiter, and ATS (Applicant Tracking System) optimization specialist. Your task is to deeply tailor a resume for a specific job posting while maintaining complete accuracy and honesty.

IMPORTANT: Generate your response in valid JSON format with this exact structure:
{
  "resume": {
    "header": { "fullName": "...", "headline": "...", "email": "...", "phone": "...", "location": "...", "links": [] },
    "summary": "...",
    "experience": [{ "company": "...", "title": "...", "location": "...", "startDate": "...", "endDate": "...", "isCurrent": false, "companyDescription": "...", "bullets": [] }],
    "skills": [{ "label": "...", "items": [] }],
    "education": [{ "school": "...", "degree": "...", "field": "...", "startDate": "...", "endDate": "...", "location": "...", "activities": [] }],
    "certifications": [{ "name": "...", "issuer": "...", "date": "..." }],
    "projects": [{ "name": "...", "description": "...", "bullets": [], "url": "..." }]
  },
  "coverLetter": "...",
  "analysis": {
    "matchScore": 0-100,
    "matchedKeywords": [],
    "missingKeywords": [],
    "summaryOfChanges": []
  }
}

Guidelines for tailoring the resume — do this thoroughly, not superficially:
1. Read the job description closely and identify the top hard skills, soft skills, tools, and qualifications the employer cares about most.
2. Rewrite the professional summary/headline so it speaks directly to this role — mention the target job title or field and the strongest 2-3 matching qualifications up front.
3. Reorder experience entries by relevance to this job, not strictly by chronology.
4. Rewrite experience bullets (don't just copy them) to:
   - Lead with strong action verbs (e.g., "Led", "Built", "Reduced", "Automated")
   - Quantify impact wherever the original resume provides or implies numbers (%, $, time saved, team size, scale)
   - Naturally incorporate exact keywords/phrases from the job posting where truthfully applicable (helps with ATS keyword matching)
   - Stay concise — one line per bullet, no fluff
5. Reorder and relabel the skills section so the most job-relevant skills appear first; group them logically (e.g., "Languages", "Frameworks", "Tools").
6. De-emphasize (but don't necessarily delete) experience/skills that are irrelevant to this role.
7. Never fabricate employers, titles, dates, skills, or achievements that aren't grounded in the master resume — you may rephrase and re-emphasize, but the underlying facts must stay accurate.
8. matchScore should be a realistic, honest 0-100 assessment of how well the CANDIDATE'S ACTUAL background (not the rewritten wording) matches the job's core requirements.
9. matchedKeywords/missingKeywords should reflect real overlap (or gaps) between the resume and the job posting's key requirements.
10. summaryOfChanges should be a short bullet list (3-6 items) describing what you changed and why, e.g., "Reordered experience to lead with cloud infrastructure work matching the DevOps focus of this role."

Guidelines for the cover letter:
1. 3-4 short paragraphs, roughly 250-350 words total.
2. Open with genuine enthusiasm tied to the specific role and company (not generic).
3. Reference 2-3 concrete, real accomplishments from the resume that map directly to what the job posting asks for.
4. Match the tone to the seniority and industry implied by the job posting (e.g., more technical for engineering roles, more narrative for design/creative roles).
5. Close with a confident, specific call to action.
6. Never invent facts not present in the master resume.`;

  const userPrompt = `Here is the master resume:

${resumeText}

---

Here is the target job posting:

${jobText}

---

Tailor this resume for the job posting above and write a matching cover letter, following every guideline in the system prompt precisely. Return the response as valid JSON following the exact structure specified in the system prompt — no markdown, no commentary, JSON only.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  let parsed: {
    resume: Partial<ResumeDocument>;
    coverLetter: string;
    analysis: Partial<MatchAnalysis>;
  };

  try {
    // Extract JSON from the response
    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (!responseText?.trim()) {
      throw new Error("Empty response from Claude");
    }

    console.log("[TAILOR] Claude response length:", responseText.length);

    // Try to find JSON block
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in response. Response preview: ${responseText.substring(0, 200)}`);
    }

    const jsonStr = jsonMatch[0];
    parsed = JSON.parse(jsonStr);

    // Validate that required fields exist
    if (!parsed.resume || typeof parsed.resume !== "object") {
      throw new Error("Invalid resume structure in response");
    }

    // Ensure resume has the expected structure with defaults
    if (!parsed.resume.header) {
      parsed.resume.header = { fullName: "", headline: "", email: "", phone: "", location: "", links: [] };
    }
    if (!parsed.resume.experience) parsed.resume.experience = [];
    if (!parsed.resume.skills) parsed.resume.skills = [];
    if (!parsed.resume.education) parsed.resume.education = [];
    if (!parsed.resume.certifications) parsed.resume.certifications = [];
    if (!parsed.resume.projects) parsed.resume.projects = [];

    console.log("[TAILOR] Successfully parsed Claude response");
  } catch (e) {
    console.error("[TAILOR] Parse error:", e);
    // Fallback if parsing fails - use master resume as base
    parsed = {
      resume: masterResume,
      coverLetter: "",
      analysis: {
        matchScore: 0,
        matchedKeywords: [],
        missingKeywords: [],
        summaryOfChanges: [],
      },
    };
  }

  const usage = response.usage as unknown as Record<string, number>;

  return {
    resume: (parsed.resume as ResumeDocument) || masterResume,
    coverLetter: parsed.coverLetter || "",
    analysis: {
      matchScore: parsed.analysis?.matchScore || 0,
      matchedKeywords: parsed.analysis?.matchedKeywords || [],
      missingKeywords: parsed.analysis?.missingKeywords || [],
      summaryOfChanges: parsed.analysis?.summaryOfChanges || [],
    },
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      cacheWriteTokens: usage.cache_creation_input_tokens || 0,
    },
  };
}
