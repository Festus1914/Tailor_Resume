
import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * Server-side session records.
 *
 * Deliberately database-backed rather than stateless JWTs: an administrator
 * disabling an account must invalidate that person's *existing* sessions
 * immediately, and a self-contained token cannot be revoked before it expires.
 * The cost is one indexed lookup per request, which buys instant revocation.
 */
export interface ISession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /**
   * SHA-256 of the opaque cookie token — never the token itself. A leaked
   * database dump then yields no usable session credentials, the same reason
   * passwords are stored hashed.
   */
  tokenHash: string;
  expiresAt: Date;
  /** Captured for the account-activity view and abuse investigation. */
  ip: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });

// Lets "revoke every session for this user" be a single delete when an admin
// disables an account or the user changes their password.
sessionSchema.index({ userId: 1 });

// TTL index: MongoDB removes expired sessions on its own, so the collection
// cannot grow without bound. Note that the background sweep runs roughly every
// 60 seconds, so expiry is still enforced in code on read rather than relying
// on the document being gone.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<ISession> =
  (mongoose.models.Session as Model<ISession>) ??
  mongoose.model<ISession>("Session", sessionSchema);
