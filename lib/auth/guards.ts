import { notFound as apiNotFound, unauthorized } from "@/lib/api";
import { notFound as nextNotFound } from "next/navigation";
import { getActiveSession, type ActiveSession } from "./session";

/**
 * Authorization helpers.
 *
 * Every protected route handler and server component calls one of these. They
 * are the actual authorization boundary — middleware only redirects, and cannot
 * be trusted for access control (see middleware.ts for why).
 */

export async function getOptionalUser(): Promise<ActiveSession | null> {
  return getActiveSession();
}

/**
 * Requires a signed-in, approved account.
 *
 * The approved check lives inside session resolution, so a pending, rejected, or
 * disabled account never resolves to a session at all and lands here as 401.
 */
export async function requireUser(): Promise<ActiveSession> {
  const session = await getActiveSession();
  if (!session) throw unauthorized();
  return session;
}

export async function requireAdmin(): Promise<ActiveSession> {
  const session = await getActiveSession();
  if (!session) {
    nextNotFound();
    throw new Error("Not reachable");
  }
  if (session.user.role !== "admin") {
    nextNotFound();
    throw new Error("Not reachable");
  }
  return session;
}

/**
 * Asserts the caller owns a resource.
 *
 * Reports 404 rather than 403 on a mismatch. Distinguishing "not yours" from
 * "doesn't exist" would let someone enumerate which ids are real, and the id of
 * another person's resume is not information worth confirming.
 */
export function assertOwnership(
  resourceUserId: unknown,
  callerUserId: unknown
): void {
  if (String(resourceUserId) !== String(callerUserId)) {
    throw apiNotFound();
  }
}
