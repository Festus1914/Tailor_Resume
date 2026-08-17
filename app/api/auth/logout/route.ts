import { NextResponse, type NextRequest } from "next/server";
import { route } from "@/lib/api";
import { destroyCurrentSession, getActiveSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/auth/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ends the current session.
 *
 * POST rather than GET: a logout reachable by navigation can be triggered by any
 * page that embeds a link or image pointing at it.
 *
 * Always reports success. Logging out when already logged out is the state the
 * caller asked for, so an error would be noise.
 */
export const POST = route(async (req: NextRequest) => {
  const session = await getActiveSession();

  await destroyCurrentSession();

  if (session) {
    await recordAudit({
      action: "user.logout",
      actorId: String(session.user._id),
      targetUserId: String(session.user._id),
      req,
    });
  }

  return NextResponse.json({ ok: true });
});
