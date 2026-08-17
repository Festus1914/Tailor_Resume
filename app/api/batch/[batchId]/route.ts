import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Batch, JobTask, TailoredResume } from "@/lib/models";
import { route, notFound, badRequest } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/batch/[batchId]
 * Get batch details with live task progress.
 */
export const GET = route(async (req: NextRequest, { params }: any) => {
  const { user } = await requireUser();
  await connectToDatabase();

  if (!mongoose.isValidObjectId(params.batchId)) {
    throw notFound("Batch not found");
  }

  const batch = await Batch.findOne({
    _id: params.batchId,
    userId: user._id,
  });

  if (!batch) {
    throw notFound("Batch not found");
  }

  // Get live task counts
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

  const total = tasks.length;
  const completed = stats.succeeded + stats.failed + stats.skipped;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Get sample failures for display
  const failures = await JobTask.find({ batchId: batch._id, status: "failed" })
    .limit(5)
    .select("url failureReason lastError");

  return NextResponse.json({
    batch: {
      id: String(batch._id),
      status: batch.status,
      submittedCount: batch.submittedCount,
      duplicateCount: batch.duplicateCount,
      invalidCount: batch.invalidCount,
      cancelRequested: batch.cancelRequested,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
    },
    progress: {
      total,
      completed,
      percentage: progress,
      stats,
    },
    failures: failures.map((f) => ({
      url: f.url,
      reason: f.failureReason,
      error: f.lastError,
    })),
  });
});

/**
 * POST /api/batch/[batchId]/cancel
 * Request cancellation of a batch.
 *
 * Sets cancelRequested flag; workers check this between stages.
 */
export const POST = route(async (req: NextRequest, { params }: any) => {
  const { user } = await requireUser();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  await connectToDatabase();

  if (!mongoose.isValidObjectId(params.batchId)) {
    throw notFound("Batch not found");
  }

  const batch = await Batch.findOne({
    _id: params.batchId,
    userId: user._id,
  });

  if (!batch) {
    throw notFound("Batch not found");
  }

  if (action === "cancel") {
    if (batch.status === "completed" || batch.status === "cancelled") {
      throw badRequest("Cannot cancel a completed batch");
    }

    await Batch.updateOne({ _id: batch._id }, { cancelRequested: true });

    return NextResponse.json({ ok: true, message: "Cancellation requested" });
  }

  if (action === "retry") {
    // Reset all failed tasks to queued for retry
    const failed = await JobTask.find({
      batchId: batch._id,
      status: "failed",
    });

    if (failed.length === 0) {
      throw badRequest("No failed tasks to retry");
    }

    const failedIds = failed.map((f) => f._id);

    await JobTask.updateMany(
      { _id: { $in: failedIds } },
      {
        status: "queued",
        attempts: 0,
        lastError: "",
        failureReason: null,
        leaseExpiresAt: null,
        claimedBy: null,
      }
    );

    // Reset batch status to running
    await Batch.updateOne({ _id: batch._id }, { status: "running" });

    return NextResponse.json({
      ok: true,
      message: `${failed.length} tasks requeued`,
    });
  }

  throw badRequest("Invalid action");
});
