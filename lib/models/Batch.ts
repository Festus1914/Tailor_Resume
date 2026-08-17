import mongoose, { Schema, type Model, type Types } from "mongoose";
import { BATCH_STATUSES, type BatchStatus } from "@/lib/types";

/**
 * A bulk submission of job URLs — the unit the user thinks in ("the 40 links I
 * pasted on Tuesday") and the handle for progress, retry, and zip export.
 *
 * Live progress counts are deliberately NOT stored here. They are aggregated
 * from JobTask on read, which is inexpensive at batch sizes up to 100 and — more
 * importantly — cannot drift. Denormalized counters incremented from concurrent
 * workers are a classic source of totals that disagree with the rows beneath
 * them. Once the batch reaches a terminal state the final tally is written to
 * `summary`, so historical batches need no aggregation at all.
 */

export interface IBatchSummary {
  succeeded: number;
  failed: number;
  skipped: number;
}

export interface IBatch {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Tasks actually created — after dedupe and validation. */
  submittedCount: number;
  /** URLs dropped before enqueue, reported back so totals reconcile. */
  duplicateCount: number;
  invalidCount: number;
  status: BatchStatus;
  /**
   * Cooperative cancellation. Workers check this between stages rather than
   * being killed mid-request, so a cancelled batch leaves no half-written
   * resumes behind.
   */
  cancelRequested: boolean;
  summary: IBatchSummary | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const summarySchema = new Schema<IBatchSummary>(
  {
    succeeded: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
  },
  { _id: false }
);

const batchSchema = new Schema<IBatch>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedCount: { type: Number, default: 0, min: 0 },
    duplicateCount: { type: Number, default: 0, min: 0 },
    invalidCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: BATCH_STATUSES, default: "queued" },
    cancelRequested: { type: Boolean, default: false },
    summary: { type: summarySchema, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

batchSchema.index({ userId: 1, createdAt: -1 });

// Lets a sweeper find batches whose tasks have all finished but which haven't
// been closed out and summarized yet.
batchSchema.index({ status: 1 });

export const Batch: Model<IBatch> =
  (mongoose.models.Batch as Model<IBatch>) ??
  mongoose.model<IBatch>("Batch", batchSchema);
