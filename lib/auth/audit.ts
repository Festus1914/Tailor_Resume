import { connectToDatabase } from "@/lib/mongodb";
import { AuditLog } from "@/lib/models";
import { clientIp, userAgent } from "@/lib/api";
import type { AuditAction } from "@/lib/types";

/**
 * Writes an audit entry.
 *
 * Never throws. An audit write failing must not turn a successful login or
 * approval into a 500 — the action already happened, and surfacing a logging
 * fault to the user would be misleading. Failures are reported to the server log
 * instead.
 */
export async function recordAudit(params: {
  action: AuditAction;
  actorId?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}): Promise<void> {
  try {
    await connectToDatabase();
    await AuditLog.create({
      action: params.action,
      actorId: params.actorId ?? null,
      targetUserId: params.targetUserId ?? null,
      // Callers are responsible for keeping this free of resume content,
      // credentials, and tokens — see the note on the AuditLog schema.
      metadata: params.metadata ?? {},
      ip: params.req ? clientIp(params.req) : "",
      userAgent: params.req ? userAgent(params.req) : "",
    });
  } catch (err) {
    console.error(`Failed to write audit entry (${params.action}):`, err);
  }
}
