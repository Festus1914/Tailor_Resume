import mongoose, { Schema, type Model, type Types } from "mongoose";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/types";

/**
 * Append-only record of security-relevant events.
 *
 * The admin dashboard can approve, disable, and change the role of any account,
 * which is exactly the kind of authority that needs an accountable trail: who
 * did it, to whom, and when. Also captures authentication events, so repeated
 * failures against one account are visible after the fact.
 *
 * `updatedAt` is intentionally disabled — an audit entry that can be edited is
 * not an audit entry.
 *
 * Deliberately excludes resume and job content. This collection is the most
 * widely readable one in the system, and putting personal data in it would
 * undermine keeping resume contents private from administrators.
 */
export interface IAuditLog {
  _id: Types.ObjectId;
  /** Who acted. Null for anonymous events such as a failed login. */
  actorId: Types.ObjectId | null;
  action: AuditAction;
  /** Who was acted upon, for administrative actions. */
  targetUserId: Types.ObjectId | null;
  /**
   * Small, non-sensitive context — e.g. `{ from: "user", to: "admin" }`. Never
   * resume text, job descriptions, tokens, or password material.
   */
  metadata: Record<string, unknown>;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetUserId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog>) ??
  mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
