import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { TailoredResume } from "@/lib/models";
import { route, notFound, badRequest } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const exportSchema = z.object({
  format: z.enum(["pdf", "docx", "text"]),
  version: z.enum(["current", "generated"]).default("current"),
});

/**
 * Converts resume document to plain text.
 */
function resumeToText(resume: any, jobTitle: string): string {
  let text = "";

  // Header
  if (resume.header?.fullName) {
    text += `${resume.header.fullName}\n`;
  }
  if (resume.header?.headline) {
    text += `${resume.header.headline}\n`;
  }
  text += "\n";

  // Contact
  const contact = [
    resume.header?.email,
    resume.header?.phone,
    resume.header?.location,
  ]
    .filter(Boolean)
    .join(" | ");
  if (contact) {
    text += contact + "\n\n";
  }

  // Summary
  if (resume.summary) {
    text += "PROFESSIONAL SUMMARY\n";
    text += resume.summary + "\n\n";
  }

  // Experience
  if (resume.experience?.length > 0) {
    text += "EXPERIENCE\n";
    resume.experience.forEach((exp: any) => {
      text += `${exp.title}\n`;
      text += `${exp.company}${exp.location ? ` (${exp.location})` : ""}\n`;
      text += `${exp.startDate} - ${exp.isCurrent ? "Present" : exp.endDate}\n`;
      if (exp.companyDescription) text += `${exp.companyDescription}\n`;
      exp.bullets?.forEach((bullet: string) => {
        text += `• ${bullet}\n`;
      });
      text += "\n";
    });
  }

  // Skills
  if (resume.skills?.length > 0) {
    text += "SKILLS\n";
    resume.skills.forEach((group: any) => {
      if (group.label) text += `${group.label}: `;
      text += group.items?.join(", ") + "\n";
    });
    text += "\n";
  }

  // Education
  if (resume.education?.length > 0) {
    text += "EDUCATION\n";
    resume.education.forEach((edu: any) => {
      text += `${edu.degree}${edu.field ? ` in ${edu.field}` : ""}\n`;
      text += `${edu.school}\n`;
      if (edu.location) text += `${edu.location}\n`;
      if (edu.activities?.length > 0) {
        text += `Activities: ${edu.activities.join(", ")}\n`;
      }
      text += "\n";
    });
  }

  // Certifications
  if (resume.certifications?.length > 0) {
    text += "CERTIFICATIONS\n";
    resume.certifications.forEach((cert: any) => {
      text += `${cert.name} - ${cert.issuer}${cert.date ? ` (${cert.date})` : ""}\n`;
    });
    text += "\n";
  }

  // Projects
  if (resume.projects?.length > 0) {
    text += "PROJECTS\n";
    resume.projects.forEach((proj: any) => {
      text += `${proj.name}\n`;
      if (proj.description) text += `${proj.description}\n`;
      proj.bullets?.forEach((bullet: string) => {
        text += `• ${bullet}\n`;
      });
      if (proj.url) text += `${proj.url}\n`;
      text += "\n";
    });
  }

  return text;
}

/**
 * GET /api/resumes/[resumeId]/export?format=pdf&version=current
 * Export tailored resume in requested format.
 */
export const GET = route(async (req: NextRequest, { params }: any) => {
  const { user } = await requireUser();
  await connectToDatabase();

  if (!mongoose.isValidObjectId(params.resumeId)) {
    throw notFound("Resume not found");
  }

  const { searchParams } = new URL(req.url);
  const { format, version } = exportSchema.parse({
    format: searchParams.get("format"),
    version: searchParams.get("version"),
  });

  const tailored = await TailoredResume.findOne({
    _id: params.resumeId,
    userId: user._id,
  });

  if (!tailored) {
    throw notFound("Resume not found");
  }

  const sourceResume = version === "current" ? tailored.current : tailored.generated;
  const resumeText = resumeToText(sourceResume.resume, tailored.jobSnapshot.title);

  // Filename
  const company = tailored.jobSnapshot.company.replace(/[^a-z0-9]/gi, "-");
  const title = tailored.jobSnapshot.title.replace(/[^a-z0-9]/gi, "-");
  const filename = `${company}-${title}-tailored-resume`.toLowerCase();

  if (format === "text") {
    return new NextResponse(resumeText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.txt"`,
      },
    });
  }

  if (format === "pdf") {
    // For now, return text format with PDF instruction
    // In production, use a PDF library like puppeteer or pdfkit
    return new NextResponse(
      `To generate a true PDF, use a PDF library like pdfkit or puppeteer.\n\n${resumeText}`,
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.txt"`,
        },
      }
    );
  }

  if (format === "docx") {
    // For production, use docx library
    // This is a placeholder that returns text
    return new NextResponse(
      `To generate a true DOCX, use a library like docx.\n\n${resumeText}`,
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.txt"`,
        },
      }
    );
  }

  throw badRequest("Invalid export format");
});
