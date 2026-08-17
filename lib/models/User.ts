import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
} from "@/lib/types";

export interface IUserQuota {
  /** Max jobs this user may process per period. Adjustable by an admin. */
  monthlyJobLimit: number;
  jobsUsedThisPeriod: number;
  periodStartedAt: Date;
}

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  /**
   * Argon2id hash. `select: false`, so it is absent from query results unless
   * explicitly requested — this makes leaking it via a JSON response the
   * exception that must be asked for, rather than the default.
   */
  passwordHash: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  approvedBy: Types.ObjectId | null;
  approvedAt: Date | null;
  rejectionReason: string;
  /** Reset on success; drives temporary lockout on repeated failures. */
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  quota: IUserQuota;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const quotaSchema = new Schema<IUserQuota>(
  {
    monthlyJobLimit: { type: Number, default: 100, min: 0 },
    jobsUsedThisPeriod: { type: Number, default: 0, min: 0 },
    periodStartedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      // Normalize on write so "User@Example.com" and "user@example.com" can
      // never become two accounts. The unique index below is case-sensitive,
      // so lowercasing here is what actually enforces one-account-per-address.
      lowercase: true,
      trim: true,
      maxlength: 320,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, default: "", trim: true, maxlength: 200 },
    role: { type: String, enum: USER_ROLES, default: "user", required: true },
    // Every account starts unusable. Only an admin moves it to "approved".
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "pending",
      required: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "", maxlength: 1000 },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date, default: null },
    quota: { type: quotaSchema, default: () => ({}) },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A real unique index, not an application-level "is this email taken?" check.
// Two concurrent signups both pass an app-level check before either inserts;
// only a database constraint actually prevents the duplicate.
userSchema.index({ email: 1 }, { unique: true });

// Admin dashboard: "show me pending accounts", "show me all admins".
userSchema.index({ status: 1, role: 1 });
userSchema.index({ createdAt: -1 });

/**
 * Authoritative login gate. Checked on every request, not just at login, so
 * that disabling an account takes effect immediately for sessions that were
 * issued while it was still approved.
 */
userSchema.methods.canLogin = function (this: IUser): boolean {
  if (this.status !== "approved") return false;
  if (this.lockedUntil && this.lockedUntil > new Date()) return false;
  return true;
};

export interface IUserMethods {
  canLogin(): boolean;
}

export type UserModel = Model<IUser, {}, IUserMethods>;

// Next.js re-executes modules on hot reload; re-registering an existing model
// name throws OverwriteModelError. Reuse the compiled model when present.
export const User: UserModel =
  (mongoose.models.User as UserModel) ??
  mongoose.model<IUser, UserModel>("User", userSchema);
