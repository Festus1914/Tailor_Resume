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

  const systemPrompt = `You are an expert resume writer and recruiter. Your task is to tailor a resume for a specific job posting while maintaining accuracy and honesty.

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

Guidelines for tailoring:
1. Reorder experience by relevance to the job, not chronological order
2. Emphasize skills and achievements that match the job description
3. Use keywords from the job posting naturally in the resume
4. Keep the same structure but update summaries and bullets to match the role
5. Remove or de-emphasize less relevant experience
6. Maintain complete accuracy - never fabricate experience`;

  const userPrompt = `Here is the master resume:

${resumeText}

---

Here is the target job posting:

${jobText}

---

Please tailor the resume to this job posting and generate a professional cover letter. Return the response as valid JSON following the structure specified in the system prompt.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
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
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    // Fallback if parsing fails
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
