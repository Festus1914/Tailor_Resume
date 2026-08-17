import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { AuditLog } from "@/lib/models";
import { requireAdmin } from "@/lib/auth/guards";
import AuditLogTable from "@/components/admin/AuditLogTable";
import type { IAuditLog } from "@/lib/models/AuditLog";

export const metadata: Metadata = { title: "Audit Log — Resume Tailor Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage() {
  await requireAdmin();
  await connectToDatabase();

  const [logs, total] = await Promise.all([
    AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .populate("actorId", "name email")
      .populate("targetUserId", "name email")
      .lean(),
    AuditLog.countDocuments({}),
  ]);

  const sanitizedLogs = logs.map((log) => ({
    ...log,
    actorId: log.actorId as any,
    targetUserId: log.targetUserId as any,
  })) as (IAuditLog & {
    actorId?: { name: string; email: string };
    targetUserId?: { name: string; email: string };
  })[];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-ink mb-1">
          Audit Log
        </h1>
        <p className="text-sm text-black/50">
          Security-relevant events: authentication, account modifications, and admin actions.
        </p>
      </header>

      <AuditLogTable
        initialLogs={sanitizedLogs}
        initialTotal={total}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
