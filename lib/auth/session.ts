import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { HydratedDocument } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Session, User, type IUser, type IUserMethods } from "@/lib/models";

/**
 * Session management.
 *
 * The cookie carries an opaque 256-bit random token and nothing else — no user
 * id, no role, no claims. Everything authoritative is looked up server-side on
 * each request, which is what allows an administrator to disable an account and
 * have it take effect on the very next request. A self-contained token cannot
 * offer that: it stays valid until it expires, whatever the database says.
 *
 * Only an HMAC of the token is stored. A leaked database therefore yields no
 * usable session credentials, for the same reason passwords are never stored in
 * the clear.
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The cookie outlives the database record on purpose. Expiry is enforced by the
 * `expiresAt` field, and a cookie presented after its session has lapsed simply
 * reads as signed-out. Keeping the cookie longer lets an active user's sliding
 * expiry keep working without needing to rewrite the cookie from a server
 * component, which Next does not permit.
 */
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Slide expiry once a quarter of the window has elapsed. Extending on every
 * request would mean a database write per request; never extending would sign
 * out someone who has been using the app continuously for seven days.
 */
const SLIDE_AFTER_MS = SESSION_TTL_MS * 0.25;

/**
 * `__Host-` is the strongest cookie prefix: browsers only accept it when the
 * cookie is Secure, has no Domain attribute, and has Path=/, which blocks a
 * subdomain from writing a session cookie for the parent domain. It also
 * requires HTTPS, so it can't be used on http://localhost in development.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-rt_session" : "rt_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is not set, or is shorter than 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return secret;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * HMAC rather than a bare SHA-256 digest. Because the token is 256 bits of
 * randomness a plain digest would already be infeasible to reverse, but keying
 * the hash means the stored value is worthless without the server secret, and
 * gives `SESSION_SECRET` real meaning: rotating it invalidates every session.
 */
function hashToken(token: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(token)
    .digest("hex");
}

export type SessionUser = HydratedDocument<IUser, IUserMethods>;

export interface ActiveSession {
  user: SessionUser;
  sessionId: string;
}

/**
 * Issues a session and sets the cookie. Route handlers only — a server
 * component cannot mutate cookies.
 */
export async function createSession(
  userId: string,
  meta: { ip: string; userAgent: string }
): Promise<void> {
  await connectToDatabase();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Resolves the caller's session, or null.
 *
 * Safe to call from server components: it writes to the database (sliding
 * expiry, and cleanup of sessions belonging to accounts that are no longer
 * approved) but never to cookies.
 */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await connectToDatabase();

  const session = await Session.findOne({ tokenHash: hashToken(token) });
  if (!session) return null;

  // Enforced in code rather than trusting the TTL index, whose background sweep
  // runs only about once a minute.
  if (session.expiresAt.getTime() <= Date.now()) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }

  const user = await User.findById(session.userId);
  if (!user) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }

  // The authoritative re-check. A session issued while the account was approved
  // must stop working the moment that stops being true.
  if (!user.canLogin()) {
    await Session.deleteMany({ userId: user._id });
    return null;
  }

  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < SESSION_TTL_MS - SLIDE_AFTER_MS) {
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await session.save();
  }

  return { user, sessionId: String(session._id) };
}

/** Deletes the current session and clears the cookie. Route handlers only. */
export async function destroyCurrentSession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;

  if (token) {
    await connectToDatabase();
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }

  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Revokes every session for a user — used when an admin disables or rejects an
 * account, so existing browser tabs lose access immediately rather than at the
 * end of their window.
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  await connectToDatabase();
  const result = await Session.deleteMany({ userId });
  return result.deletedCount ?? 0;
}

/** Shape sent to the client. Never includes passwordHash. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: IUser["role"];
  status: IUser["status"];
  quota: { monthlyJobLimit: number; jobsUsedThisPeriod: number };
  createdAt: string;
}

export function serializeUser(user: SessionUser | IUser): PublicUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    quota: {
      monthlyJobLimit: user.quota.monthlyJobLimit,
      jobsUsedThisPeriod: user.quota.jobsUsedThisPeriod,
    },
    createdAt: user.createdAt.toISOString(),
  };
}
