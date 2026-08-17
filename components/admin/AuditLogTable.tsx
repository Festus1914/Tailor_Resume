"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import type { IAuditLog } from "@/lib/models/AuditLog";
import type { AuditAction } from "@/lib/types";

interface AuditLogTableProps {
  initialLogs: (IAuditLog & {
    actorId?: { name: string; email: string };
    targetUserId?: { name: string; email: string };
  })[];
  initialTotal: number;
  pageSize: number;
}

const ACTION_STYLES: Record<AuditAction, { label: string; color: string }> = {
  "user.signup": { label: "Signup", color: "bg-blue-50 text-blue-700 border-blue-200" },
  "user.login": {
    label: "Login",
    color: "bg-green-50 text-green-700 border-green-200",
  },
  "user.login_failed": {
    label: "Login Failed",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  "user.logout": {
    label: "Logout",
    color: "bg-gray-50 text-gray-700 border-gray-200",
  },
  "user.approved": {
    label: "Approved",
    color: "bg-accentLight text-accent border-accent/20",
  },
  "user.rejected": {
    label: "Rejected",
    color: "bg-[#fdf1ea] text-[#b3452c] border-[#b3452c]/20",
  },
  "user.disabled": {
    label: "Disabled",
    color: "bg-red-50 text-red-700 border-red-200",
  },
  "user.enabled": {
    label: "Enabled",
    color: "bg-accentLight text-accent border-accent/20",
  },
  "user.role_changed": {
    label: "Role Changed",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  "user.quota_changed": {
    label: "Quota Changed",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  "user.deleted": {
    label: "Deleted",
    color: "bg-red-50 text-red-700 border-red-200",
  },
};

export default function AuditLogTable({
  initialLogs,
  initialTotal,
  pageSize,
}: AuditLogTableProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);

  const [filterAction, setFilterAction] = useState<AuditAction | "all">("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFirstRender = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (filterAction !== "all") params.set("action", filterAction);

      const res = await fetch(`/api/admin/audit?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load audit logs.");

      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [filterAction, page, pageSize]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filterAction]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const uniqueActions = Array.from(
    new Set(logs.map((l) => l.action as AuditAction))
  ).sort();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-black/10 rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
            Search (actor/target)
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or email"
              disabled
              className="w-full border border-black/10 rounded-lg pl-9 pr-3 py-2 text-sm bg-[#fcfcfb] text-black/40 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="relative">
          <label className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
            Action
          </label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value as any)}
            className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors appearance-none pr-8"
          >
            <option value="all">All actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {ACTION_STYLES[action]?.label || action}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2.5 top-[2.3rem] text-black/30 pointer-events-none"
          />
        </div>

        {loading && (
          <Loader2 size={16} className="animate-spin text-black/30 mb-2.5" />
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="bg-[#fdf1ea] border border-[#b3452c]/20 text-[#b3452c] text-sm rounded-xl p-3.5"
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f6f5f2] text-left">
              <tr className="text-xs uppercase tracking-wide text-black/40">
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-black/40">
                    No audit logs match those filters.
                  </td>
                </tr>
              )}

              {logs.map((log) => {
                const actionStyle = ACTION_STYLES[log.action];
                return (
                  <tr
                    key={String(log._id)}
                    className="border-t border-black/5 align-middle"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium ${actionStyle?.color}`}
                      >
                        {actionStyle?.label || log.action}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {log.actorId ? (
                        <div>
                          <div className="font-medium text-ink">
                            {log.actorId.name || "—"}
                          </div>
                          <div className="text-xs text-black/40">
                            {log.actorId.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-black/40">Anonymous</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {log.targetUserId ? (
                        <div>
                          <div className="font-medium text-ink">
                            {log.targetUserId.name || "—"}
                          </div>
                          <div className="text-xs text-black/40">
                            {log.targetUserId.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-black/40">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-black/40 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/5 text-xs text-black/40">
            <span>
              Page {page} of {totalPages} · {total} events
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
