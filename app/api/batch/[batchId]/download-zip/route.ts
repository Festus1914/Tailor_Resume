import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Batch, JobTask, TailoredResume } from "@/lib/models";
import { requireUser } from "@/lib/auth/guards";
import { badRequest, notFound } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/batch/[batchId]/download-zip
 * Download all completed resumes in a batch as a ZIP file.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { user } = await requireUser();
    await connectToDatabase();

    // Verify batch ownership
    const batch = await Batch.findOne({
      _id: params.batchId,
      userId: user._id,
    });

    if (!batch) {
      throw notFound("Batch not found");
    }

    // Get completed tasks with resumes
    const completedTasks = await JobTask.find({
      batchId: batch._id,
      status: "succeeded",
      resumeId: { $exists: true, $ne: null },
    });

    if (completedTasks.length === 0) {
      throw badRequest("No completed resumes in this batch");
    }

    // Dynamic import of zip library
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // Add each completed resume as PDF
    for (const task of completedTasks) {
      const resume = await TailoredResume.findById(task.resumeId);
      if (!resume) continue;

      // Create simple text-based resume for ZIP
      const resumeText = formatResumeAsText(resume.current);
      const filename = `${resume.jobSnapshot?.company || "Job"}-${resume.jobSnapshot?.title || "Resume"}.txt`
        .replace(/[^a-z0-9\s-]/gi, "")
        .slice(0, 50);

      zip.file(filename, resumeText);
    }

    const buffer = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="batch-${batch._id}-resumes.zip"`,
      },
    });
  } catch (error) {
    console.error("ZIP download error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download" },
      { status: error instanceof Error && "status" in error ? (error.status as number) : 500 }
    );
  }
}

function formatResumeAsText(resume: any): string {
  const lines: string[] = [];

  if (resume?.header?.fullName) {
    lines.push(resume.header.fullName);
  }

  if (resume?.header?.headline) {
    lines.push(resume.header.headline);
  }

  if (resume?.header?.email || resume?.header?.phone) {
    const contact = [resume.header.email, resume.header.phone]
      .filter(Boolean)
      .join(" | ");
    if (contact) lines.push(contact);
  }

  if (resume?.summary) {
    lines.push("");
    lines.push("SUMMARY");
    lines.push(resume.summary);
  }

  if (resume?.experience && resume.experience.length > 0) {
    lines.push("");
    lines.push("EXPERIENCE");
    for (const exp of resume.experience) {
      lines.push(`${exp.title}, ${exp.company}`);
      if (exp.startDate || exp.endDate) {
        lines.push(`${exp.startDate} - ${exp.endDate || "Present"}`);
      }
      if (exp.bullets) {
        for (const bullet of exp.bullets) {
          lines.push(`- ${bullet}`);
        }
      }
    }
  }

  if (resume?.skills && resume.skills.length > 0) {
    lines.push("");
    lines.push("SKILLS");
    for (const skillGroup of resume.skills) {
      lines.push(`${skillGroup.label}: ${skillGroup.items.join(", ")}`);
    }
  }

  return lines.join("\n");
}
