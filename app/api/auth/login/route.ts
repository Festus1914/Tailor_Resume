import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models";
import { route, clientIp, userAgent, ApiError, tooManyRequests } from "@/lib/api";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword, fakeVerify } from "@/lib/auth/password";
import { createSession, serializeUser } from "@/lib/auth/session";
import {
  isLockedOut,
  lockoutMinutesRemaining,
  registerFailedLogin,
  clearFailedLogins,
} from "@/lib/auth/lockout";
import { recordAudit } from "@/lib/auth/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Identical response for "no such account" and "wrong password".
 *
 * Any difference between the two — wording, status code, or response time — turns
 * the login form into an oracle for which email addresses are registered.
 */
const GENERIC_FAILURE = "Incorrect email or password.";

export const POST = route(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const { email, password } = loginSchema.parse(body);

  await connectToDatabase();

  // passwordHash is `select: false` on the schema, so it must be asked for.
  const user = await User.findOne({ email }).select("+passwordHash");

  if (!user) {
    // Spend the same work a real verification would, so the timing of this path
    // is indistinguishable from a wrong password against a real account.
    await fakeVerify(password);
    await recordAudit({
      action: "user.login_failed",
      metadata: { reason: "unknown_email" },
      req,
    });
    throw new ApiError(401, "invalid_credentials", GENERIC_FAILURE);
  }

  if (isLockedOut(user)) {
    const minutes = lockoutMinutesRemaining(user);
    await recordAudit({
      action: "user.login_failed",
      targetUserId: String(user._id),
      metadata: { reason: "locked_out" },
      req,
    });
    throw tooManyRequests(
      `Too many failed attempts. Try again in ${minutes} minute${
        minutes === 1 ? "" : "s"
      }.`
    );
  }

  const passwordOk = await verifyPassword(user.passwordHash, password);

  if (!passwordOk) {
    await registerFailedLogin(String(user._id));
    await recordAudit({
      action: "user.login_failed",
      targetUserId: String(user._id),
      metadata: { reason: "bad_password" },
      req,
    });
    throw new ApiError(401, "invalid_credentials", GENERIC_FAILURE);
  }

  // Past this point the caller has proven they hold the credentials, so telling
  // them their account's actual state discloses nothing they don't own — and
  // "waiting for approval" is far more useful than a generic refusal.
  if (user.status !== "approved") {
    // Correct credentials, so the failure counter is not the user's problem.
    await clearFailedLogins(String(user._id));

    const message =
      user.status === "pending"
        ? "Your account is waiting for administrator approval."
        : user.status === "rejected"
          ? "Your account request was not approved."
          : "Your account has been disabled.";

    throw new ApiError(403, `account_${user.status}`, message);
  }

  await clearFailedLogins(String(user._id));
  await createSession(String(user._id), {
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  await recordAudit({
    action: "user.login",
    actorId: String(user._id),
    targetUserId: String(user._id),
    req,
  });

  return NextResponse.json({ user: serializeUser(user) });
});
