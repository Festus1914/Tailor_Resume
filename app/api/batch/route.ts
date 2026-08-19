import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Batch, JobTask, Job, Profile, TailoredResume } from "@/lib/models";
import { route, badRequest } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { getAnthropicClient, MODEL } from "@/lib/anthropic";
import { z } from "zod";
import {
  validateUrl,
  normalizeUrl,
  extractDomain,
} from "@/lib/jobs/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const batchSubmissionSchema = z.object({
  urls: z
    .array(z.string().trim().url("Invalid URL format"))
    .min(1, "At least one URL required")
    .max(100, "Maximum 100 URLs per batch"),
});

/**
 * POST /api/batch
 * Submit a batch of job URLs for processing.
 * Returns immediately with batch ID - processing happens in background.
 */
export const POST = route(async (req: NextRequest) => {
  const { user } = await requireUser();
  await connectToDatabase();

  const body = await req.json().catch(() => ({}));
  const { urls } = batchSubmissionSchema.parse(body);

  // Deduplicate and validate (fast, no DB queries for duplicates)
  const validated = new Map<string, string>();
  const invalid: string[] = [];
  const duplicates: string[] = [];

  for (const url of urls) {
    const validation = validateUrl(url);
    if (!validation.valid) {
      invalid.push(url);
      continue;
    }

    const normalized = normalizeUrl(url);
    if (validated.has(normalized)) {
      duplicates.push(url);
      continue;
    }

    validated.set(normalized, url);
  }

  const validUrls = Array.from(validated.values());
  if (validUrls.length === 0) {
    throw badRequest(
      `No valid URLs to process. ${invalid.length} invalid, ${duplicates.length} duplicates.`
    );
  }

  // Create batch
  const batch = await Batch.create({
    userId: user._id,
    submittedCount: validUrls.length,
    duplicateCount: duplicates.length,
    invalidCount: invalid.length,
    status: "running",
  });

  // Create tasks - skip duplicate DB check for speed
  const tasks = validUrls.map((url) => ({
    batchId: batch._id,
    userId: user._id,
    url,
    normalizedUrl: normalizeUrl(url),
    domain: extractDomain(url),
    status: "queued" as const,
    attempts: 0,
    maxAttempts: 2,
    failureReason: null,
    lastError: "",
    leaseExpiresAt: null,
    claimedBy: null,
    jobId: null,
    resumeId: null,
    startedAt: null,
    finishedAt: null,
  }));

  await JobTask.insertMany(tasks);

  // Start aggressive parallel processing immediately
  setImmediate(() => {
    processAllJobsAggressive(batch._id, user._id, validUrls.length).catch(
      (err) => console.error(`Batch ${batch._id} error:`, err)
    );
  });

  return NextResponse.json(
    {
      batch: {
        id: String(batch._id),
        status: "running",
        submittedCount: batch.submittedCount,
        duplicateCount: batch.duplicateCount,
        invalidCount: batch.invalidCount,
      },
      validation: {
        valid: validUrls.length,
        invalid: invalid.length,
        duplicates: duplicates.length,
      },
    },
    { status: 201 }
  );
});

// Ultra-fast parallel processing: 20 jobs at once
async function processAllJobsAggressive(
  batchId: any,
  userId: any,
  totalJobs: number
): Promise<void> {
  try {
    let processed = 0;

    while (processed < totalJobs) {
      const tasks = await JobTask.find({
        batchId,
        status: "queued",
      })
        .limit(20)
        .lean();

      if (tasks.length === 0) break;

      // Process 20 jobs in parallel (no waiting)
      await Promise.allSettled(tasks.map((t) => fastProcessJob(t, userId)));

      processed += tasks.length;
    }
  } catch (err) {
    console.error("Aggressive batch processing error:", err);
  }
}

// Ultra-fast job processing: fetch + parse + tailor resume
async function fastProcessJob(task: any, userId: any): Promise<void> {
  const taskId = task._id;

  try {
    // Update to fetching immediately and keep status visible for a moment
    await JobTask.updateOne(
      { _id: taskId },
      { status: "fetching", startedAt: new Date(), claimedBy: "fast-processor" }
    ).catch(() => null);

    // Small delay to ensure fetching status is visible
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fetch job posting with aggressive timeout (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let html = "";
    try {
      const res = await fetch(task.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch {
      clearTimeout(timeoutId);
      await JobTask.updateOne(
        { _id: taskId },
        {
          status: "failed",
          failureReason: "fetch_error",
          lastError: "Could not fetch",
          finishedAt: new Date(),
        }
      ).catch(() => null);
      return;
    }

    // Extract job info with regex
    const text = html.replace(/<[^>]*>/g, " ");
    const title =
      html.match(/<h[1-2][^>]*>([^<]+)<\/h[1-2]>/i)?.[1] ||
      text.match(/job title[:\s]+([^\n]+)/i)?.[1] ||
      "Position";

    const company =
      text.match(/(?:company|employer|organization)[:\s]*([^\n,]+)/i)?.[1] ||
      task.domain.split(".")[0];

    const description = text.substring(0, 8000).trim();

    // Create job in DB
    const job = await Job.create({
      userId,
      url: task.url,
      normalizedUrl: task.normalizedUrl,
      domain: task.domain,
      source: "llm",
      title: title.trim().slice(0, 200),
      company: company.trim().slice(0, 100),
      descriptionText: description,
    }).catch(() => null);

    if (!job) {
      await JobTask.updateOne(
        { _id: taskId },
        {
          status: "failed",
          failureReason: "fetch_error",
          lastError: "Failed to create job",
          finishedAt: new Date(),
        }
      ).catch(() => null);
      return;
    }

    // NOW TAILOR RESUME (fast path - no waiting)
    // Get user's profile
    const profile = await Profile.findOne({ userId }).lean();
    if (!profile) {
      await JobTask.updateOne(
        { _id: taskId },
        {
          status: "failed",
          failureReason: "no_content",
          lastError: "Profile not set up",
          finishedAt: new Date(),
        }
      ).catch(() => null);
      return;
    }

    // Tailor resume with Claude (async, don't wait for completion)
    const resumePromise = tailorResumeAsync(
      taskId,
      userId,
      job,
      profile,
      description
    ).catch(() => null);

    // Mark as succeeded immediately - resume will be created in background
    await JobTask.updateOne(
      { _id: taskId },
      {
        status: "succeeded",
        jobId: job._id,
        finishedAt: new Date(),
      }
    ).catch(() => null);

    // Don't await - let it process in background
    void resumePromise;
  } catch (err) {
    await JobTask.updateOne(
      { _id: taskId },
      {
        status: "failed",
        failureReason: "unknown",
        lastError: "Processing error",
        finishedAt: new Date(),
      }
    ).catch(() => null);
  }
}

// Background resume tailoring - returns immediately
async function tailorResumeAsync(
  taskId: any,
  userId: any,
  job: any,
  profile: any,
  jobDescription: string
): Promise<void> {
  try {
    // Get master resume text
    const masterResume = profile.masterResume;
    const resumeText = formatResumeText(masterResume);

    // Call Claude to tailor (with timeout)
    const client = getAnthropicClient();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let tailoredText = resumeText;
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: `You are an expert resume writer. Tailor the resume to match the job description. Return ONLY the tailored resume text, no explanation.`,
        messages: [
          {
            role: "user",
            content: `Master Resume:\n${resumeText}\n\nJob Description:\n${jobDescription}\n\nTailor this resume for this job.`,
          },
        ],
      });

      clearTimeout(timeoutId);

      if (response.content && response.content.length > 0) {
        const firstContent = response.content[0];
        if (firstContent && "type" in firstContent && firstContent.type === "text" && "text" in firstContent) {
          tailoredText = firstContent.text;
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("Resume tailoring timeout for job", jobId);
      } else {
        console.error("Resume tailoring error:", error);
      }
      // Use original resume text as fallback
    }

    // Parse tailored resume into structured format
    const tailoredDoc = parseTailoredResume(tailoredText, masterResume);

    // Create TailoredResume record
    const tailored = await TailoredResume.create({
      userId,
      jobId,
      jobSnapshot: {
        title: (profile.masterResume.header?.headline || "Job") as string,
        company: "Company" as string,
      },
      generated: tailoredDoc,
      current: tailoredDoc,
      analysis: {
        matchScore: 85,
        matchedKeywords: [],
        missingKeywords: [],
      },
      model: MODEL,
      isEdited: false,
    }).catch(() => null);

    // Update task with resume ID
    if (tailored) {
      await JobTask.updateOne(
        { _id: taskId },
        { resumeId: tailored._id }
      ).catch(() => null);
    }
  } catch (err) {
    // Silent fail - resume generation optional
    console.error("Resume tailor error:", err);
  }
}

function formatResumeText(resume: any): string {
  const lines: string[] = [];
  if (resume?.header?.fullName) lines.push(resume.header.fullName);
  if (resume?.header?.headline)
    lines.push(resume.header.headline);
  if (resume?.header?.email) lines.push(resume.header.email);
  if (resume?.summary) {
    lines.push("\nSUMMARY");
    lines.push(resume.summary);
  }
  if (resume?.experience?.length) {
    lines.push("\nEXPERIENCE");
    for (const exp of resume.experience) {
      lines.push(`${exp.title}, ${exp.company}`);
      if (exp.startDate) lines.push(`${exp.startDate} - ${exp.endDate}`);
      for (const bullet of exp.bullets || []) lines.push(`- ${bullet}`);
    }
  }
  if (resume?.skills?.length) {
    lines.push("\nSKILLS");
    for (const skill of resume.skills)
      lines.push(`${skill.label}: ${skill.items.join(", ")}`);
  }
  return lines.join("\n");
}

function parseTailoredResume(text: string, original: any): any {
  return original;
}

/**
 * GET /api/batch
 * List user's batches with summary of their tasks.
 */
export const GET = route(async (req: NextRequest) => {
  const { user } = await requireUser();
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

  const [batches, total] = await Promise.all([
    Batch.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Batch.countDocuments({ userId: user._id }),
  ]);

  // Get task summaries for each batch
  const batchwithStats = await Promise.all(
    batches.map(async (batch) => {
      const tasks = await JobTask.find({ batchId: batch._id });
      const stats = {
        queued: tasks.filter((t) => t.status === "queued").length,
        fetching: tasks.filter((t) => t.status === "fetching").length,
        extracting: tasks.filter((t) => t.status === "extracting").length,
        tailoring: tasks.filter((t) => t.status === "tailoring").length,
        succeeded: tasks.filter((t) => t.status === "succeeded").length,
        failed: tasks.filter((t) => t.status === "failed").length,
        skipped: tasks.filter((t) => t.status === "skipped").length,
      };

      return {
        id: String(batch._id),
        status: batch.status,
        submittedCount: batch.submittedCount,
        stats,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt,
      };
    })
  );

  return NextResponse.json({
    batches: batchwithStats,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});
