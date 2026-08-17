import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  JOB_SOURCES,
  JOB_FETCH_STATUSES,
  type JobSource,
  type JobFetchStatus,
} from "@/lib/types";

/**
 * A target job posting, either extracted from a URL or pasted manually.
 *
 * Scoped per user rather than shared globally. A shared cache would be cheaper,
 * but postings are edited by hand after extraction (the confirm-before-tailor
 * step), so one user's corrections would silently rewrite another's job — and
 * the set of companies someone is applying to is itself sensitive.
 */
export interface IJob {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** As submitted, for display and for re-fetching. Empty for manual entries. */
  url: string;
  /**
   * Canonical form used for dedupe: lowercased host, tracking parameters
   * stripped, fragment and trailing slash removed. `null` for manual entries so
   * they are excluded from the unique index (see partial index below).
   */
  normalizedUrl: string | null;
  domain: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  descriptionText: string;
  /** Discrete requirement lines, when extraction can separate them. */
  requirements: string[];
  source: JobSource;
  /**
   * 0-1 confidence in the extraction. JSON-LD scores high (the site declared
   * these fields); model extraction from prose scores lower. Surfaced in the
   * confirmation step so the user knows how hard to look before tailoring.
   */
  extractionConfidence: number;
  fetchStatus: JobFetchStatus;
  httpStatus: number | null;
  error: string;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    url: { type: String, default: "", trim: true, maxlength: 2048 },
    normalizedUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2048,
    },
    domain: { type: String, default: "", trim: true, lowercase: true },
    title: { type: String, default: "", trim: true, maxlength: 300 },
    company: { type: String, default: "", trim: true, maxlength: 300 },
    location: { type: String, default: "", trim: true, maxlength: 300 },
    employmentType: { type: String, default: "", trim: true, maxlength: 100 },
    descriptionText: { type: String, default: "" },
    requirements: { type: [String], default: [] },
    source: { type: String, enum: JOB_SOURCES, default: "manual" },
    extractionConfidence: { type: Number, default: 0, min: 0, max: 1 },
    fetchStatus: { type: String, enum: JOB_FETCH_STATUSES, default: "ok" },
    httpStatus: { type: Number, default: null },
    error: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true }
);

// Dedupe by URL per user, so resubmitting a batch doesn't re-scrape and
// re-tailor work already done.
//
// The partial filter is what makes this safe: manual jobs store `null`, and a
// plain unique index would treat every null as the same value and reject a
// user's second hand-entered posting. Restricting the index to string values
// leaves manual entries unconstrained.
jobSchema.index(
  { userId: 1, normalizedUrl: 1 },
  {
    unique: true,
    partialFilterExpression: { normalizedUrl: { $type: "string" } },
  }
);

jobSchema.index({ userId: 1, createdAt: -1 });
jobSchema.index({ userId: 1, company: 1 });

export const Job: Model<IJob> =
  (mongoose.models.Job as Model<IJob>) ??
  mongoose.model<IJob>("Job", jobSchema);
