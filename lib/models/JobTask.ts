import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  TASK_STATUSES,
  TASK_FAILURE_REASONS,
  type TaskStatus,
  type TaskFailureReason,
} from "@/lib/types";

/**
 * One unit of work in a bulk submission: fetch a URL, extract the posting,
 * tailor a resume. Also the queue itself — there is no separate broker.
 *
 * Why a database-backed queue rather than Redis/BullMQ: MongoDB's
 * `findOneAndUpdate` is atomic, which is the only primitive a work queue
 * strictly needs. Adding a second datastore for a workload of at most a few
 * hundred tasks per batch would be infrastructure without a payoff.
 *
 * The lease pattern is what makes it safe. A worker claims a task by atomically
 * flipping its status and stamping `leaseExpiresAt` in the future. If that
 * worker crashes, the lease simply expires and the task becomes claimable
 * again — whereas a plain "status = running" flag would strand it forever.
 */
export interface IJobTask {
  _id: Types.ObjectId;
  batchId: Types.ObjectId;
  userId: Types.ObjectId;
  url: string;
  normalizedUrl: string;
  /** Throttling key, so one career site isn't hit with 40 parallel requests. */
  domain: string;
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  failureReason: TaskFailureReason | null;
  /** Operator-facing detail. Never rendered raw to the user. */
  lastError: string;
  /**
   * When the current claim lapses. Null when unclaimed. A reaper requeues tasks
   * whose lease has passed while still in a non-terminal state.
   */
  leaseExpiresAt: Date | null;
  claimedBy: string | null;
  /** Populated as stages complete, so a retry can resume rather than restart. */
  jobId: Types.ObjectId | null;
  resumeId: Types.ObjectId | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const jobTaskSchema = new Schema<IJobTask>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    normalizedUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    domain: { type: String, default: "", trim: true, lowercase: true },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "queued",
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    // Three total tries for transient failures. Permanent categories (404,
    // robots-disallowed, unsafe URL) short-circuit without consuming retries.
    maxAttempts: { type: Number, default: 3, min: 1 },
    failureReason: {
      type: String,
      enum: TASK_FAILURE_REASONS,
      default: null,
    },
    lastError: { type: String, default: "", maxlength: 2000 },
    leaseExpiresAt: { type: Date, default: null },
    claimedBy: { type: String, default: null },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", default: null },
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: "TailoredResume",
      default: null,
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// THE claim index. Every worker poll is a query on (status, leaseExpiresAt)
// sorted by creation order; without this index each claim would collection-scan
// while several workers contend for the same documents.
jobTaskSchema.index({ status: 1, leaseExpiresAt: 1, createdAt: 1 });

// Batch status board — the endpoint the UI polls every few seconds.
jobTaskSchema.index({ batchId: 1, createdAt: 1 });

jobTaskSchema.index({ userId: 1, createdAt: -1 });

// Per-domain politeness: how many requests to this host are in flight now.
jobTaskSchema.index({ domain: 1, status: 1 });

export const JobTask: Model<IJobTask> =
  (mongoose.models.JobTask as Model<IJobTask>) ??
  mongoose.model<IJobTask>("JobTask", jobTaskSchema);
