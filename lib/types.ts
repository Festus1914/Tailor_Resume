// ---------------------------------------------------------------------------
// Existing tailoring contract
//
// Still used by app/api/tailor/route.ts and the client. Phase 5 replaces the
// plain-text `tailoredResume` field with the structured ResumeDocument below;
// until then both shapes coexist so nothing breaks mid-migration.
// ---------------------------------------------------------------------------

export interface TailorRequest {
  resumeText: string;
  jobDescription: string;
  companyName?: string;
  applicantName?: string;
}

export interface TailorResult {
  tailoredResume: string;
  matchScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: string[];
  coverLetter: string;
}

// ---------------------------------------------------------------------------
// Structured resume document
//
// This is the format the master resume is stored in, and (from Phase 5) the
// format the model emits directly. Storing structure instead of positionally
// significant plain text is what removes the need to re-derive sections with
// regex at export time.
//
// Dates are display strings ("08/2018", "Present", "Spring 2020"), not Date
// objects: resume dates are frequently month-precision or open-ended, and
// round-tripping them through Date would both lose that nuance and introduce
// timezone drift. They are rendered verbatim.
// ---------------------------------------------------------------------------

export interface ResumeLink {
  label: string;
  url: string;
}

export interface ResumeHeader {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: ResumeLink[];
}

export interface ResumeExperience {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  /** One-line company/mission description, when the source resume has one. */
  companyDescription: string;
  /** Bullets may contain **bold** markers for JD-relevant terms. */
  bullets: string[];
}

export interface ResumeSkillGroup {
  label: string;
  items: string[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  location: string;
  activities: string[];
}

export interface ResumeCertification {
  name: string;
  issuer: string;
  date: string;
}

export interface ResumeProject {
  name: string;
  description: string;
  bullets: string[];
  url: string;
}

export interface ResumeDocument {
  header: ResumeHeader;
  summary: string;
  experience: ResumeExperience[];
  skills: ResumeSkillGroup[];
  education: ResumeEducation[];
  certifications: ResumeCertification[];
  projects: ResumeProject[];
}

// ---------------------------------------------------------------------------
// Enumerations
//
// Declared as const arrays so the same list feeds both the TypeScript union
// and the Mongoose schema `enum`, keeping validation and types in lockstep.
// ---------------------------------------------------------------------------

export const USER_ROLES = ["admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "disabled",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** How a job posting's fields were obtained. */
export const JOB_SOURCES = ["jsonld", "llm", "manual"] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

export const JOB_FETCH_STATUSES = ["ok", "failed"] as const;
export type JobFetchStatus = (typeof JOB_FETCH_STATUSES)[number];

/**
 * Task lifecycle. The three middle values double as progress labels in the
 * batch UI, which is why the stages are distinct statuses rather than a
 * separate `stage` field.
 */
export const TASK_STATUSES = [
  "queued",
  "fetching",
  "extracting",
  "tailoring",
  "succeeded",
  "failed",
  "skipped",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Statuses a task will never leave — used by the queue and the poll endpoint. */
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = [
  "succeeded",
  "failed",
  "skipped",
];

/**
 * Why a task failed, as a category rather than a free-text message.
 *
 * A batch of 100 URLs aimed at sites that block scraping will produce many
 * failures at once; grouping them ("94 blocked by the site") is the difference
 * between a comprehensible summary and 94 opaque error strings. The distinction
 * also drives retry policy: `rate_limited` and `timeout` are worth retrying,
 * `not_found` and `robots_disallowed` never are.
 */
export const TASK_FAILURE_REASONS = [
  "blocked",
  "not_found",
  "no_content",
  "rate_limited",
  "robots_disallowed",
  "unsafe_url",
  "fetch_error",
  "timeout",
  "model_error",
  "quota_exceeded",
  "cancelled",
  "unknown",
] as const;
export type TaskFailureReason = (typeof TASK_FAILURE_REASONS)[number];

/** Failure categories that will never succeed on retry. */
export const PERMANENT_FAILURE_REASONS: readonly TaskFailureReason[] = [
  "not_found",
  "robots_disallowed",
  "unsafe_url",
  "quota_exceeded",
  "cancelled",
];

export const BATCH_STATUSES = [
  "queued",
  "running",
  "completed",
  "cancelled",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "user.signup",
  "user.login",
  "user.login_failed",
  "user.logout",
  "user.approved",
  "user.rejected",
  "user.disabled",
  "user.enabled",
  "user.role_changed",
  "user.quota_changed",
  "user.deleted",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ---------------------------------------------------------------------------
// Analysis attached to a generated resume
// ---------------------------------------------------------------------------

export interface MatchAnalysis {
  /** 0-100, how well the ORIGINAL master resume matched the posting. */
  matchScore: number;
  matchedKeywords: string[];
  /** Requirements that could NOT be truthfully covered — gaps to address. */
  missingKeywords: string[];
  summaryOfChanges: string[];
}

/** Token accounting, kept per generation so batch cost is attributable. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}
