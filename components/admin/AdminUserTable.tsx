"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Search,
  ShieldCheck,
  ShieldOff,
  Slash,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import type { UserRole, UserStatus } from "@/lib/types";

interface AdminUserTableProps {
  initialUsers: PublicUser[];
  initialTotal: number;
  initialPendingCount: number;
  pageSize: number;
  /** Used to suppress actions that would lock the operator out of their own account. */
  currentUserId: string;
}

type StatusFilter = UserStatus | "all";
type RoleFilter = UserRole | "all";

/** A destructive or role-changing action awaiting explicit confirmation. */
interface PendingAction {
  userId: string;
  kind: "reject" | "disable" | "promote" | "demote" | "delete";
  reason: string;
}

const STATUS_STYLES: Record<UserStatus, string> = {
  approved: "bg-accentLight text-accent border-accent/20",
  pending: "bg-[#fdf6e3] text-[#8a6d1f] border-[#b8860b]/20",
  rejected: "bg-[#fdf1ea] text-[#b3452c] border-[#b3452c]/20",
  disabled: "bg-black/5 text-black/40 border-black/10",
};

export default function AdminUserTable({
  initialUsers,
  initialTotal,
  initialPendingCount,
  pageSize,
  currentUserId,
}: AdminUserTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [page, setPage] = useState(1);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PendingAction | null>(null);

  // Skip the fetch on first render — the server already supplied page one.
  const isFirstRender = useRef(true);

  // Debounced so typing a search term doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status,
        role,
        q: debouncedQuery,
        page: String(page),
        limit: String(pageSize),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load users.");

      setUsers(data.users);
      setTotal(data.total);
      setPendingCount(data.pendingCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [status, role, debouncedQuery, page, pageSize]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void load();
  }, [load]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [status, role, debouncedQuery]);

  async function runAction(
    userId: string,
    body: Record<string, unknown>
  ): Promise<void> {
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That action failed.");

      // Patch the row in place, then refresh counts from the server so the
      // pending badge stays accurate.
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? (data.user as PublicUser) : u))
      );
      setConfirming(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-black/10 rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
            Search
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
              className="w-full border border-black/10 rounded-lg pl-9 pr-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
            />
          </div>
        </div>

        <Select
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            ["all", "All statuses"],
            ["pending", `Pending${pendingCount ? ` (${pendingCount})` : ""}`],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
            ["disabled", "Disabled"],
          ]}
        />

        <Select
          label="Role"
          value={role}
          onChange={(v) => setRole(v as RoleFilter)}
          options={[
            ["all", "All roles"],
            ["admin", "Admins"],
            ["user", "Users"],
          ]}
        />

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
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-black/40">
                    No accounts match those filters.
                  </td>
                </tr>
              )}

              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const isBusy = busyId === u.id;
                const isConfirming = confirming?.userId === u.id;

                return (
                  <tr
                    key={u.id}
                    className="border-t border-black/5 align-middle"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">
                        {u.name || "—"}
                        {isSelf && (
                          <span className="ml-2 text-xs text-black/30">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-black/40">{u.email}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          u.role === "admin"
                            ? "bg-accentLight text-accent border-accent/20"
                            : "bg-black/5 text-black/50 border-black/10"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[u.status]}`}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-black/40 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3">
                      {isConfirming ? (
                        <ConfirmRow
                          action={confirming}
                          busy={isBusy}
                          onReasonChange={(reason) =>
                            setConfirming({ ...confirming, reason })
                          }
                          onCancel={() => setConfirming(null)}
                          onConfirm={() => {
                            const { kind, reason } = confirming;
                            if (kind === "reject")
                              return runAction(u.id, {
                                action: "reject",
                                reason,
                              });
                            if (kind === "disable")
                              return runAction(u.id, { action: "disable" });
                            if (kind === "delete")
                              return fetch(`/api/admin/users/${u.id}`, {
                                method: "DELETE",
                              })
                                .then(async (res) => {
                                  const data = await res.json();
                                  if (!res.ok)
                                    throw new Error(data.error ?? "Delete failed");
                                  setUsers((prev) => prev.filter((x) => x.id !== u.id));
                                  setConfirming(null);
                                  void load();
                                })
                                .catch((e) => {
                                  setBusyId(null);
                                  setError(
                                    e instanceof Error
                                      ? e.message
                                      : "Delete failed"
                                  );
                                })
                                .finally(() => setBusyId(null));
                            return runAction(u.id, {
                              action: "setRole",
                              role: kind === "promote" ? "admin" : "user",
                            });
                          }}
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {(u.status === "pending" ||
                            u.status === "rejected") && (
                            <ActionButton
                              primary
                              busy={isBusy}
                              icon={<Check size={13} />}
                              label="Approve"
                              onClick={() =>
                                runAction(u.id, { action: "approve" })
                              }
                            />
                          )}

                          {u.status === "pending" && (
                            <ActionButton
                              busy={isBusy}
                              icon={<X size={13} />}
                              label="Reject"
                              onClick={() =>
                                setConfirming({
                                  userId: u.id,
                                  kind: "reject",
                                  reason: "",
                                })
                              }
                            />
                          )}

                          {u.status === "disabled" && (
                            <ActionButton
                              primary
                              busy={isBusy}
                              icon={<UserCheck size={13} />}
                              label="Enable"
                              onClick={() =>
                                runAction(u.id, { action: "enable" })
                              }
                            />
                          )}

                          {/* Self-disable is blocked server-side too; hiding the
                              button just avoids offering a guaranteed error. */}
                          {u.status === "approved" && !isSelf && (
                            <ActionButton
                              busy={isBusy}
                              icon={<Slash size={13} />}
                              label="Disable"
                              onClick={() =>
                                setConfirming({
                                  userId: u.id,
                                  kind: "disable",
                                  reason: "",
                                })
                              }
                            />
                          )}

                          {u.role === "user" && (
                            <ActionButton
                              busy={isBusy}
                              icon={<ShieldCheck size={13} />}
                              label="Make admin"
                              onClick={() =>
                                setConfirming({
                                  userId: u.id,
                                  kind: "promote",
                                  reason: "",
                                })
                              }
                            />
                          )}

                          {u.role === "admin" && !isSelf && (
                            <ActionButton
                              busy={isBusy}
                              icon={<ShieldOff size={13} />}
                              label="Remove admin"
                              onClick={() =>
                                setConfirming({
                                  userId: u.id,
                                  kind: "demote",
                                  reason: "",
                                })
                              }
                            />
                          )}

                          {!isSelf && (
                            <ActionButton
                              busy={isBusy}
                              icon={<Trash2 size={13} />}
                              label="Delete"
                              onClick={() =>
                                setConfirming({
                                  userId: u.id,
                                  kind: "delete",
                                  reason: "",
                                })
                              }
                            />
                          )}
                        </div>
                      )}
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
              Page {page} of {totalPages} · {total} accounts
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

const CONFIRM_COPY: Record<PendingAction["kind"], string> = {
  reject: "Reject this account?",
  disable: "Disable this account? Their active sessions end immediately.",
  promote: "Grant full administrator access?",
  demote: "Remove administrator access?",
  delete: "Permanently delete this account? This cannot be undone.",
};

function ConfirmRow({
  action,
  busy,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  action: PendingAction;
  busy: boolean;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-2">
      <span className="text-xs text-black/60 text-right">
        {CONFIRM_COPY[action.kind]}
      </span>

      {action.kind === "reject" && (
        <input
          value={action.reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Reason (optional)"
          className="w-48 border border-black/10 rounded-lg px-2.5 py-1.5 text-xs bg-[#fcfcfb] focus:border-accent transition-colors"
        />
      )}

      <div className="flex gap-1.5">
        <button
          onClick={onCancel}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`text-xs px-3 py-1.5 rounded-full text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
            action.kind === "delete"
              ? "bg-red-600 hover:bg-red-700"
              : "bg-[#b3452c] hover:bg-[#b3452c]/90"
          }`}
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          Confirm
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  busy,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  busy: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50 whitespace-nowrap ${
        primary
          ? "bg-accent text-white hover:bg-accent/90"
          : "border border-black/10 hover:bg-black/5"
      }`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
