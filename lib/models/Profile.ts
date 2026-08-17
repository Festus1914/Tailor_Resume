import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { ResumeDocument } from "@/lib/types";
import { resumeDocumentSchema, emptyResumeDocument } from "./resumeDocument";

/**
 * A user's professional profile and master resume — the single source of truth
 * that every tailoring run derives from. One document per user.
 */
export interface IProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  masterResume: ResumeDocument;
  /**
   * The original pasted text, kept when a profile was imported rather than
   * typed. Retained for two reasons: the structural importer is heuristic, so
   * the user may need to consult the original to correct it; and it lets a
   * re-import run against improved parsing later without asking for the file
   * again. Never used for tailoring — `masterResume` is authoritative.
   */
  rawText: string;
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<IProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    masterResume: {
      type: resumeDocumentSchema,
      default: () => emptyResumeDocument(),
    },
    rawText: { type: String, default: "" },
  },
  { timestamps: true }
);

// One profile per user, enforced by the database rather than by convention.
profileSchema.index({ userId: 1 }, { unique: true });

/**
 * Whether this profile can support a tailoring run. A name and at least one
 * role is the practical floor — below that the model has nothing to reorder or
 * re-emphasize, and would be forced to invent content to fill the template.
 */
profileSchema.methods.isTailorable = function (this: IProfile): boolean {
  return (
    this.masterResume.header.fullName.trim().length > 0 &&
    this.masterResume.experience.length > 0
  );
};

export interface IProfileMethods {
  isTailorable(): boolean;
}

export type ProfileModel = Model<IProfile, {}, IProfileMethods>;

export const Profile: ProfileModel =
  (mongoose.models.Profile as ProfileModel) ??
  mongoose.model<IProfile, ProfileModel>("Profile", profileSchema);
