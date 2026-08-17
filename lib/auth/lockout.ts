import { User } from "@/lib/models";
import type { SessionUser } from "./session";

/**
 * Per-account lockout after repeated failed logins.
 *
 * This throttles credential stuffing against a *known* address. It is not a
 * substitute for per-IP rate limiting, which bounds an attacker spraying one
 * password across many addresses and is scheduled for the hardening phase — the
 * two defend against different attacks and both are needed.
 */

const LOCKOUT_THRESHOLD = 5;

/**
 * Escalating durations. A brief first lockout keeps a genuine user who mistyped
 * their password from being stranded, while sustained attempts get expensive.
 */
function lockDurationMs(attempts: number): number {
  if (attempts >= 15) return 24 * 60 * 60 * 1000;
  if (attempts >= 10) return 60 * 60 * 1000;
  return 15 * 60 * 1000;
}

export function isLockedOut(user: Pick<SessionUser, "lockedUntil">): boolean {
  return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();
}

/** Minutes remaining, rounded up, for the "try again in N minutes" message. */
export function lockoutMinutesRemaining(
  user: Pick<SessionUser, "lockedUntil">
): number {
  if (!user.lockedUntil) return 0;
  const ms = user.lockedUntil.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60_000) : 0;
}

/**
 * Records a failed attempt and locks the account once the threshold is reached.
 *
 * Uses an atomic `$inc` and reads back the new value, so simultaneous attempts
 * cannot both read the same count and overwrite each other's increment.
 */
export async function registerFailedLogin(userId: string): Promise<void> {
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { failedLoginAttempts: 1 } },
    { new: true, projection: { failedLoginAttempts: 1 } }
  );
  if (!updated) return;

  if (updated.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          lockedUntil: new Date(
            Date.now() + lockDurationMs(updated.failedLoginAttempts)
          ),
        },
      }
    );
  }
}

/** Clears failure state after a successful login. */
export async function clearFailedLogins(userId: string): Promise<void> {
  await User.updateOne(
    { _id: userId },
    {
      $set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    }
  );
}
