import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Batch, JobTask } from "@/lib/models";
import { requireUser } from "@/lib/auth/guards";
import { notFound } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/batch/[batchId]/progress
 * Get real-time progress of a batch without fetching full task details.
 * Used for polling progress updates.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { user } = await requireUser();
    await connectToDatabase();

    const batch = await Batch.findOne({
      _id: params.batchId,
      userId: user._id,
    });

    if (!batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    // Get task counts by status (lightweight query)
    const [queued, fetching, extracting, tailoring, succeeded, failed, skipped] =
      await Promise.all([
        JobTask.countDocuments({ batchId: batch._id, status: "queued" }),
        JobTask.countDocuments({ batchId: batch._id, status: "fetching" }),
        JobTask.countDocuments({ batchId: batch._id, status: "extracting" }),
        JobTask.countDocuments({ batchId: batch._id, status: "tailoring" }),
        JobTask.countDocuments({ batchId: batch._id, status: "succeeded" }),
        JobTask.countDocuments({ batchId: batch._id, status: "failed" }),
        JobTask.countDocuments({ batchId: batch._id, status: "skipped" }),
      ]);

    const total = batch.submittedCount;
    const completed = succeeded + failed + skipped;
    const inProgress = fetching + extracting + tailoring;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({
      batchId: String(batch._id),
      status: batch.status,
      submittedCount: batch.submittedCount,
      progress: {
        queued,
        fetching,
        extracting,
        tailoring,
        succeeded,
        failed,
        skipped,
        completed,
        inProgress,
        percent: progressPercent,
      },
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
    });
  } catch (error) {
    console.error("Progress endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to get progress" },
      { status: 500 }
    );
  }
}
