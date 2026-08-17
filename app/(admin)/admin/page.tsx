import type { Metadata } from "next";
import Link from "next/link";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { connectToDatabase } from "@/lib/mongodb";
import { User, AuditLog } from "@/lib/models";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Dashboard — Resume Tailor Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();
  await connectToDatabase();

  const [
    totalUsers,
    pendingCount,
    approvedCount,
    disabledCount,
    adminCount,
    recentAudit,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ status: "pending" }),
    User.countDocuments({ status: "approved" }),
    User.countDocuments({ status: "disabled" }),
    User.countDocuments({ role: "admin" }),
    AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("actorId", "name email")
      .populate("targetUserId", "name email"),
  ]);

  const statCards = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: <AlertCircle className="w-5 h-5" />,
      color: "text-black/40",
      bgColor: "bg-black/5",
    },
    {
      label: "Pending Approval",
      value: pendingCount,
      icon: <Clock className="w-5 h-5" />,
      color: "text-[#8a6d1f]",
      bgColor: "bg-[#fdf6e3]",
      href: "/admin/users?status=pending",
    },
    {
      label: "Approved",
      value: approvedCount,
      icon: <CheckCircle className="w-5 h-5" />,
      color: "text-accent",
      bgColor: "bg-accentLight",
    },
    {
      label: "Admins",
      value: adminCount,
      icon: <AlertCircle className="w-5 h-5" />,
      color: "text-accent",
      bgColor: "bg-accentLight",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-ink mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-black/50">System overview and recent activity</p>
      </header>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href ?? "#"}
            className={`${card.bgColor} border border-black/10 rounded-2xl p-4 ${
              card.href ? "hover:border-black/20 transition-colors cursor-pointer" : ""
            }`}
          >
            <div className={`${card.color} mb-3 flex items-center justify-between`}>
              {card.icon}
              <span className="text-2xl font-bold">{card.value}</span>
            </div>
            <p className="text-xs uppercase tracking-wide text-black/50">
              {card.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-black/5">
          <h2 className="text-sm font-semibold text-ink">Recent Activity</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f6f5f2]">
              <tr className="text-xs uppercase tracking-wide text-black/40">
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Actor</th>
                <th className="px-4 py-3 text-left font-medium">Target</th>
                <th className="px-4 py-3 text-left font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-black/40">
                    No recent activity
                  </td>
                </tr>
              ) : (
                recentAudit.map((log) => (
                  <tr key={String(log._id)} className="border-t border-black/5">
                    <td className="px-4 py-3 font-medium text-accent">
                      {formatAction(log.action)}
                    </td>
                    <td className="px-4 py-3 text-black/60">
                      {log.actorId
                        ? `${(log.actorId as any).name || (log.actorId as any).email}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-black/60">
                      {log.targetUserId
                        ? `${(log.targetUserId as any).name || (log.targetUserId as any).email}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-black/40 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 sm:px-6 py-3 border-t border-black/5 bg-[#f6f5f2]">
          <Link
            href="/admin/audit"
            className="text-xs text-accent hover:underline font-medium"
          >
            View full audit log →
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .split(".")
    .slice(1)
    .join(" ")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
