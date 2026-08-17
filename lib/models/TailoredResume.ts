import mongoose, { Schema, type Model, type Types } from "mongoose";
import type {
  ResumeDocument,
  MatchAnalysis,
  TokenUsage,
} from "@/lib/types";
import { resumeDocumentSchema, emptyResumeDocument } from "./resumeDocument";

/**
 * One tailoring run: a master resume aimed at one job posting.
 *
 * Three design points worth understanding before changing this schema.
 *
 * 1. `generated` vs `current`. The model's output is stored immutably in
 *    `generated`; user edits land in `current`. Overwriting in place — which is
 *    what the pre-database version did — destroys the original, and with it the
 *    ability to revert, to show an honest "edited" indicator, or to diff what
 *    the AI actually produced against what was sent out.
 *
 * 2. `profileSnapshot`. The master resume is copied in at generation time.
 *    Without it, editing the profile later would retroactively change the
 *    "before" side of every past comparison and make the match score
 *    unauditable.
 *
 * 3. `jobSnapshot`. Company and title are denormalized so lists render without
 *    a join and stay correctly labelled even if the job record is later edited
 *    or removed.
 */

export interface IJobSnapshot {
  title: string;
  company: string;
  url: string;
}

export interface IGeneratedContent {
  resume: ResumeDocument;
  coverLetter: string;
}

export interface ITailoredResume {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  /** Set when this run came from a bulk submission; null for single runs. */
  batchId: Types.ObjectId | null;
  jobSnapshot: IJobSnapshot;
  profileSnapshot: ResumeDocument;
  generated: IGeneratedContent;
  analysis: MatchAnalysis;
  current: IGeneratedContent;
  isEdited: boolean;
  editedAt: Date | null;
  /** Model id that produced this, so output can be attributed after upgrades. */
  model: string;
  usage: TokenUsage;
  createdAt: Date;
  updatedAt: Date;
}

const jobSnapshotSchema = new Schema<IJobSnapshot>(
  {
    title: { type: String, default: "", trim: true },
    company: { type: String, default: "", trim: true },
    url: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const generatedContentSchema = new Schema<IGeneratedContent>(
  {
    resume: { type: resumeDocumentSchema, default: () => emptyResumeDocument() },
    coverLetter: { type: String, default: "" },
  },
  { _id: false }
);

const analysisSchema = new Schema<MatchAnalysis>(
  {
    matchScore: { type: Number, default: 0, min: 0, max: 100 },
    matchedKeywords: { type: [String], default: [] },
    missingKeywords: { type: [String], default: [] },
    summaryOfChanges: { type: [String], default: [] },
  },
  { _id: false }
);

const usageSchema = new Schema<TokenUsage>(
  {
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
    cacheWriteTokens: { type: Number, default: 0 },
  },
  { _id: false }
);

const tailoredResumeSchema = new Schema<ITailoredResume>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", default: null },
    jobSnapshot: { type: jobSnapshotSchema, default: () => ({}) },
    profileSnapshot: {
      type: resumeDocumentSchema,
      default: () => emptyResumeDocument(),
    },
    generated: { type: generatedContentSchema, default: () => ({}) },
    analysis: { type: analysisSchema, default: () => ({}) },
    current: { type: generatedContentSchema, default: () => ({}) },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    model: { type: String, default: "" },
    usage: { type: usageSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// The resume library: newest first, scoped to the owner. Also the index that
// cursor pagination pages over.
tailoredResumeSchema.index({ userId: 1, createdAt: -1 });

// "Have I already tailored for this posting?" and the per-job history view.
tailoredResumeSchema.index({ userId: 1, jobId: 1 });

// Batch detail view and the zip-the-whole-batch export.
tailoredResumeSchema.index({ batchId: 1 });

tailoredResumeSchema.index({ userId: 1, "jobSnapshot.company": 1 });

export const TailoredResume: Model<ITailoredResume> =
  (mongoose.models.TailoredResume as Model<ITailoredResume>) ??
  mongoose.model<ITailoredResume>("TailoredResume", tailoredResumeSchema);
