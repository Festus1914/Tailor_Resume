import { NextResponse } from "next/server";
import { connectToDatabase, isConnected } from "@/lib/mongodb";
// Importing the barrel registers every schema, so this endpoint also surfaces
// schema-compilation errors (bad enum, malformed index) rather than letting
// them first appear on a user-facing request.
import "@/lib/models";

export const runtime = "nodejs";
// Never cached: a cached "healthy" response is worse than no health check.
export const dynamic = "force-dynamic";

/**
 * Liveness check for the database connection.
 *
 * Intentionally returns almost nothing. This route is unauthenticated until
 * Phase 3 adds session handling, so it must not disclose collection names,
 * document counts, driver versions, the connection string, or index state —
 * all of which are useful to an attacker and none of which are needed to answer
 * "is the app up?". Detailed diagnostics belong behind an admin guard.
 */
export async function GET() {
  try {
    await connectToDatabase();

    return NextResponse.json({
      ok: isConnected(),
      database: isConnected() ? "connected" : "unavailable",
    });
  } catch (err) {
    // Log the real reason server-side; return a generic failure to the caller.
    console.error("Health check failed:", err);

    return NextResponse.json(
      { ok: false, database: "unavailable" },
      { status: 503 }
    );
  }
}
