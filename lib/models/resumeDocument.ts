import { Schema } from "mongoose";
import type { ResumeDocument } from "@/lib/types";

/**
 * Reusable sub-schema for a structured resume.
 *
 * Embedded in two places:
 *   - Profile.masterResume    — the user's editable source of truth
 *   - TailoredResume.*        — the generated output, plus an immutable
 *                               snapshot of the master it was derived from
 *
 * `_id: false` throughout: these are value objects, not independently
 * addressable documents, and suppressing the ids keeps embedded snapshots
 * compact and diffable.
 */

const linkSchema = new Schema(
  {
    label: { type: String, default: "", trim: true },
    url: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const headerSchema = new Schema(
  {
    fullName: { type: String, default: "", trim: true },
    headline: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    links: { type: [linkSchema], default: [] },
  },
  { _id: false }
);

const experienceSchema = new Schema(
  {
    company: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    startDate: { type: String, default: "", trim: true },
    endDate: { type: String, default: "", trim: true },
    isCurrent: { type: Boolean, default: false },
    companyDescription: { type: String, default: "" },
    bullets: { type: [String], default: [] },
  },
  { _id: false }
);

const skillGroupSchema = new Schema(
  {
    label: { type: String, default: "", trim: true },
    items: { type: [String], default: [] },
  },
  { _id: false }
);

const educationSchema = new Schema(
  {
    school: { type: String, default: "", trim: true },
    degree: { type: String, default: "", trim: true },
    field: { type: String, default: "", trim: true },
    startDate: { type: String, default: "", trim: true },
    endDate: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    activities: { type: [String], default: [] },
  },
  { _id: false }
);

const certificationSchema = new Schema(
  {
    name: { type: String, default: "", trim: true },
    issuer: { type: String, default: "", trim: true },
    date: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const projectSchema = new Schema(
  {
    name: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    bullets: { type: [String], default: [] },
    url: { type: String, default: "", trim: true },
  },
  { _id: false }
);

export const resumeDocumentSchema = new Schema<ResumeDocument>(
  {
    header: { type: headerSchema, default: () => ({}) },
    summary: { type: String, default: "" },
    experience: { type: [experienceSchema], default: [] },
    skills: { type: [skillGroupSchema], default: [] },
    education: { type: [educationSchema], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    projects: { type: [projectSchema], default: [] },
  },
  { _id: false }
);

/** An empty structured resume — used as the default for a brand-new profile. */
export function emptyResumeDocument(): ResumeDocument {
  return {
    header: {
      fullName: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      links: [],
    },
    summary: "",
    experience: [],
    skills: [],
    education: [],
    certifications: [],
    projects: [],
  };
}
