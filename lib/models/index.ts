import { connectToDatabase } from "@/lib/mongodb";
import { User } from "./User";
import { Session } from "./Session";
import { Profile } from "./Profile";
import { Job } from "./Job";
import { TailoredResume } from "./TailoredResume";
import { Batch } from "./Batch";
import { JobTask } from "./JobTask";
import { AuditLog } from "./AuditLog";

/**
 * Barrel for every model.
 *
 * Importing from here rather than from individual files guarantees all schemas
 * are registered before use. That matters for `ref`-based population: resolving
 * a ref by name throws MissingSchemaError if the referenced model's module was
 * never imported, which is easy to hit when only one model is imported directly.
 */

export { User, Session, Profile, Job, TailoredResume, Batch, JobTask, AuditLog };

export type { IUser, IUserQuota, IUserMethods, UserModel } from "./User";
export type { ISession } from "./Session";
export type { IProfile, IProfileMethods, ProfileModel } from "./Profile";
export type { IJob } from "./Job";
export type {
  ITailoredResume,
  IGeneratedContent,
  IJobSnapshot,
} from "./TailoredResume";
export type { IBatch, IBatchSummary } from "./Batch";
export type { IJobTask } from "./JobTask";
export type { IAuditLog } from "./AuditLog";

export { resumeDocumentSchema, emptyResumeDocument } from "./resumeDocument";

const ALL_MODELS = [
  User,
  Session,
  Profile,
  Job,
  TailoredResume,
  Batch,
  JobTask,
  AuditLog,
];

/**
 * Creates or updates every declared index.
 *
 * Run this deliberately — on deploy, or via `npm run db:indexes` — rather than
 * from the request path. `autoIndex` is disabled in production (see
 * lib/mongodb.ts) precisely so that a cold request never blocks behind an index
 * build on a large collection.
 *
 * Uses `syncIndexes`, which also DROPS indexes present in the database but no
 * longer declared in a schema. That keeps schema and database honestly in step;
 * it does mean an index added by hand in Atlas will be removed, so add indexes
 * to the schema instead.
 */
export type IndexSyncResult =
  | { model: string; ok: true }
  | { model: string; ok: false; error: string };

export async function ensureIndexes(): Promise<IndexSyncResult[]> {
  await connectToDatabase();

  const results: IndexSyncResult[] = [];
  for (const model of ALL_MODELS) {
    try {
      await model.syncIndexes();
      results.push({ model: model.modelName, ok: true });
    } catch (err) {
      // Report every model rather than aborting on the first failure, so one
      // bad index doesn't hide the state of the rest.
      results.push({
        model: model.modelName,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

/** Model names, for diagnostics and the health endpoint. */
export const MODEL_NAMES = ALL_MODELS.map((m) => m.modelName);
