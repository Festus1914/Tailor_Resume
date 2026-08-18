import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedJobData } from "./advanced-extractor";

/**
 * Cover Letter Generator - Creates professional cover letters
 */

export interface CoverLetterContent {
  text: string;
  isGenerated: boolean;
}

const client = new Anthropic();

/**
 * Generate cover letter using Claude
 */
export async function generateCoverLetter(
  fullName: string,
  email: string,
  masterResume: string,
  jobData: ExtractedJobData
): Promise<CoverLetterContent> {
  try {
    console.log("[COVER_LETTER] Generating cover letter");

    const prompt = `Write a professional cover letter for this job application.

APPLICANT:
Name: ${fullName}
Email: ${email}

MASTER RESUME (summary):
${masterResume.substring(0, 1000)}

JOB DETAILS:
Company: ${jobData.company}
Position: ${jobData.title}
Location: ${jobData.location}
Key Requirements: ${jobData.requirements.slice(0, 5).join(", ")}
Description: ${jobData.description.substring(0, 500)}

Create a compelling cover letter that:
1. Opens with enthusiasm for the specific role
2. Highlights 2-3 relevant skills from the resume
3. Shows understanding of the company/role
4. Closes with a call to action
5. Maintains professional tone

Format:
[Your Name]
[Your Email]
[Date]

[Recipient Name - use generic if unknown]
[Company Name]
[Location]

Dear Hiring Manager,

[Opening paragraph]
[Middle paragraphs]
[Closing paragraph]

Best regards,
[Your Name]`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";

    if (!text || text.length < 200) {
      throw new Error("Cover letter generation failed");
    }

    console.log("[COVER_LETTER] Generated cover letter:", text.length, "characters");

    return {
      text: text.trim(),
      isGenerated: true,
    };
  } catch (error) {
    console.error("[COVER_LETTER] Error generating cover letter:", error);

    // Fallback to template
    return generateCoverLetterTemplate(fullName, email, jobData);
  }
}

/**
 * Generate cover letter from template (fallback)
 */
function generateCoverLetterTemplate(
  fullName: string,
  email: string,
  jobData: ExtractedJobData
): CoverLetterContent {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const template = `${fullName}
${email}
${date}

Hiring Manager
${jobData.company}
${jobData.location}

Dear Hiring Manager,

I am writing to express my strong interest in the ${jobData.title} position at ${jobData.company}. With my background in ${jobData.requirements[0] || "the required technologies"}, I am confident in my ability to contribute meaningfully to your team.

Throughout my career, I have developed expertise in ${jobData.requirements.slice(0, 2).join(" and ")}, which directly aligns with the requirements outlined in your job posting. I am particularly drawn to ${jobData.company}'s commitment to innovation and would be excited to bring my skills and passion to your organization.

I am confident that my experience and dedication make me an excellent candidate for this role. I would welcome the opportunity to discuss how I can contribute to your team's success. Thank you for considering my application.

Best regards,
${fullName}`;

  return {
    text: template,
    isGenerated: false,
  };
}

/**
 * Validate cover letter content
 */
export function validateCoverLetter(content: string): boolean {
  const minLength = 200;
  const minParagraphs = 2;

  if (!content || content.length < minLength) return false;
  if (content.split("\n\n").length < minParagraphs) return false;

  return true;
}
