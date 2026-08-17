import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getOptionalUser } from "@/lib/auth/guards";
import { serializeUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The current user, or null.
 *
 * Returns 200 with `user: null` rather than 401 when signed out: this is a
 * status query, and "nobody is signed in" is a successful answer to it.
 */
export const GET = route(async () => {
  const session = await getOptionalUser();

  return NextResponse.json({
    user: session ? serializeUser(session.user) : null,
  });
});
