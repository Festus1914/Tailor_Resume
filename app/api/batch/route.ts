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

// Controlled concurrency: process 3 jobs at a time to avoid API rate limits and timeouts
async function processAllJobsAggressive(
  batchId: any,
  userId: any,
  totalJobs: number
): Promise<void> {
  const CONCURRENCY = 3; // Max 3 concurrent Claude API calls
  console.log(`[BATCH] Starting batch processing with concurrency=${CONCURRENCY}`);

  try {
    let processed = 0;
    let retryQueue: any[] = [];

    while (processed < totalJobs || retryQueue.length > 0) {
      // Get next batch of jobs to process
      let tasksToProcess = [];

      if (retryQueue.length > 0) {
        // Process retries first
        tasksToProcess = retryQueue.splice(0, CONCURRENCY);
        console.log(`[BATCH] Processing ${tasksToProcess.length} retries`);
      } else {
        // Get new queued tasks
        const newTasks = await JobTask.find({
          batchId,
          status: "queued",
        })
          .limit(CONCURRENCY)
          .lean();

        tasksToProcess = newTasks;
        if (tasksToProcess.length > 0) {
          processed += tasksToProcess.length;
          console.log(`[BATCH] Processing ${tasksToProcess.length} new tasks (${processed}/${totalJobs})`);
        }
      }

      if (tasksToProcess.length === 0) {
        // Check if there are any still-processing tasks
        const inProgress = await JobTask.countDocuments({
          batchId,
          status: { $in: ["fetching", "extracting", "tailoring"] },
        });

        if (inProgress === 0) {
          console.log(`[BATCH] All jobs processed (${processed}/${totalJobs})`);
          break;
        }

        // Wait before checking again
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      // Process tasks with controlled concurrency
      const results = await Promise.allSettled(
        tasksToProcess.map((t) => fastProcessJob(t, userId))
      );

      // Track failures for retry
      results.forEach((result, idx) => {
        if (result.status === "rejected") {
          const task = tasksToProcess[idx];
          const attempts = (task.attempts || 0) + 1;

          if (attempts < 2) {
            console.log(`[BATCH] Task ${task._id} failed, queuing for retry (attempt ${attempts}/2)`);
            retryQueue.push({ ...task, attempts });
          } else {
            console.log(`[BATCH] Task ${task._id} failed after 2 attempts, giving up`);
          }
        }
      });

      // Small delay between batches to avoid rate limiting
      if (tasksToProcess.length > 0 && processed < totalJobs) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`[BATCH] Batch ${batchId} processing complete`);
  } catch (err) {
    console.error("[BATCH] Batch processing error:", err);
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

    // Mark as tailoring (in progress) - will be updated to succeeded when resume is created
    await JobTask.updateOne(
      { _id: taskId },
      {
        status: "tailoring",
        jobId: job._id,
      }
    ).catch(() => null);

    // Tailor resume with Claude (async, don't wait for completion)
    // tailorResumeAsync will mark the task as succeeded or failed
    const resumePromise = tailorResumeAsync(
      taskId,
      userId,
      job,
      profile,
      description
    ).catch((err) => {
      console.error(`[TAILOR_ASYNC] Error tailoring resume for job ${job._id}:`, err);
      // Mark as failed if tailoring crashes
      JobTask.updateOne(
        { _id: taskId },
        {
          status: "failed",
          failureReason: "tailor_error",
          lastError: err instanceof Error ? err.message : "Unknown error",
          finishedAt: new Date(),
        }
      ).catch(() => null);
    });

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

// Check if all tasks in a batch are complete, and if so, mark batch as completed
async function checkAndCompleteBatch(userId: any, jobId: any): Promise<void> {
  try {
    // Find the batch this job belongs to (via its task)
    const task = await JobTask.findOne({ jobId }).select("batchId");
    if (!task || !task.batchId) return;

    const batchId = task.batchId;

    // Count tasks that are still processing
    const inProgress = await JobTask.countDocuments({
      batchId,
      status: { $in: ["queued", "fetching", "extracting", "tailoring"] },
    });

    // If no tasks are in progress, mark batch as completed
    if (inProgress === 0) {
      await Batch.updateOne(
        { _id: batchId, userId },
        {
          status: "completed",
          completedAt: new Date(),
        }
      ).catch(() => null);

      console.log(`[BATCH] Batch ${batchId} completed`);
    }
  } catch (err) {
    console.error("[BATCH] Error checking batch completion:", err);
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
    const masterResume = profile.masterResume;

    // Call Claude to tailor (with 30-second timeout for JSON generation)
    const client = getAnthropicClient();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let tailoredText = "";
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 6000,
        system: `You are an expert resume writer, professional recruiter, and ATS optimization specialist. Tailor the resume to match the job description thoroughly:
- Rewrite the summary to speak directly to this role.
- Reorder experience by relevance to the job, not chronology.
- Rewrite bullets with strong action verbs, quantified impact where the original supports it, and job-posting keywords used truthfully.
- Reorder skills so the most relevant ones appear first.
- Never fabricate employers, titles, dates, or achievements not grounded in the original resume.

Return ONLY valid JSON (no markdown, no explanation) matching this structure:
{
  "header": {"fullName": "string", "headline": "string", "email": "string", "phone": "string", "location": "string", "links": [{"label": "string", "url": "string"}]},
  "summary": "string",
  "experience": [{"company": "string", "title": "string", "location": "string", "startDate": "string", "endDate": "string", "isCurrent": boolean, "companyDescription": "string", "bullets": ["string"]}],
  "skills": [{"label": "string", "items": ["string"]}],
  "education": [{"school": "string", "degree": "string", "field": "string", "startDate": "string", "endDate": "string", "location": "string", "activities": ["string"]}],
  "certifications": [{"name": "string", "issuer": "string", "date": "string"}],
  "projects": [{"name": "string", "description": "string", "bullets": ["string"], "url": "string"}]
}

Keep all fields present in the master resume; only reorder/reword content to fit the job. Do not remove factual information.`,
        messages: [
          {
            role: "user",
            content: `Master Resume (JSON):\n${JSON.stringify(masterResume)}\n\nJob Description:\n${jobDescription}\n\nTailor this resume for this job and return the JSON.`,
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
        console.warn("Resume tailoring timeout for job", job._id);
      } else {
        console.error("Resume tailoring error:", error);
      }
      // Use original resume text as fallback
    }

    // Parse tailored resume into structured format
    const tailoredDoc = parseTailoredResume(tailoredText, masterResume);

    // Create TailoredResume record
    try {
      const tailored = await TailoredResume.create({
        userId,
        jobId: job._id,
        jobSnapshot: {
          title: job.title || "Position",
          company: job.company || "Company",
        },
        profileSnapshot: masterResume,
        generated: { resume: tailoredDoc, coverLetter: "" },
        current: { resume: tailoredDoc, coverLetter: "" },
        analysis: {
          matchScore: 85,
          matchedKeywords: [],
          missingKeywords: [],
        },
        model: MODEL,
        isEdited: false,
      });

      // Mark task as succeeded ONLY after resume is created
      await JobTask.updateOne(
        { _id: taskId },
        {
          status: "succeeded",
          resumeId: tailored._id,
          finishedAt: new Date(),
        }
      ).catch(() => null);

      console.log(`[TAILOR_ASYNC] Resume created successfully for job ${job._id}`);

      // Check if batch is complete
      await checkAndCompleteBatch(job.userId, job._id);
    } catch (err) {
      console.error(`[TAILOR_ASYNC] Failed to create resume for job ${job._id}:`, err);
      // Mark task as failed if resume creation fails
      await JobTask.updateOne(
        { _id: taskId },
        {
          status: "failed",
          failureReason: "resume_creation_failed",
          lastError: err instanceof Error ? err.message : "Failed to create resume",
          finishedAt: new Date(),
        }
      ).catch(() => null);

      await checkAndCompleteBatch(job.userId, job._id);
    }
  } catch (err) {
    console.error("[TAILOR_ASYNC] Unexpected error:", err);
    // Mark as failed
    await JobTask.updateOne(
      { _id: taskId },
      {
        status: "failed",
        failureReason: "unknown",
        lastError: err instanceof Error ? err.message : "Unknown error",
        finishedAt: new Date(),
      }
    ).catch(() => null);

    await checkAndCompleteBatch(job.userId, job._id);
  }
}

function parseTailoredResume(text: string, original: any): any {
  if (!text || !text.trim()) {
    return original;
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[BATCH_TAILOR] No JSON found in Claude response, using original resume");
      return original;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Basic sanity check - must have at least a header or experience
    if (!parsed || (!parsed.header && !parsed.experience)) {
      console.warn("[BATCH_TAILOR] Parsed JSON missing expected fields, using original resume");
      return original;
    }

    return parsed;
  } catch (err) {
    console.error("[BATCH_TAILOR] Failed to parse tailored resume JSON:", err);
    return original;
  }
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
