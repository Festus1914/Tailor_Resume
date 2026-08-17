"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle, XCircle, RotateCw } from "lucide-react";

interface BatchProgressViewProps {
  batchId: string;
}

interface BatchStatus {
  batch: {
    id: string;
    status: string;
    submittedCount: number;
    duplicateCount: number;
    invalidCount: number;
    completedAt: string | null;
  };
  progress: {
    total: number;
    completed: number;
    percentage: number;
    stats: {
      queued: number;
      fetching: number;
      extracting: number;
      tailoring: number;
      succeeded: number;
      failed: number;
      skipped: number;
    };
  };
  failures: Array<{
    url: string;
    reason: string;
    error: string;
  }>;
}

export default function BatchProgressView({
  batchId,
}: BatchProgressViewProps) {
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/batch/${batchId}`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
        setError(null);
      } else {
        setError(data.error || "Failed to load batch status");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load batch");
    } finally {
      setLoading(false);
    }
  }

  async function fetchProgress() {
    try {
      const res = await fetch(`/api/batch/${batchId}/progress`);
      const data = await res.json();
      if (res.ok) {
        // Update progress without full refresh
        setStatus((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            batch: {
              ...prev.batch,
              status: data.status,
            },
            progress: {
              total: data.submittedCount,
              completed:
                data.progress.succeeded +
                data.progress.failed +
                data.progress.skipped,
              percentage: data.progress.percent,
              stats: {
                queued: data.progress.queued,
                fetching: data.progress.fetching,
                extracting: data.progress.extracting,
                tailoring: data.progress.tailoring,
                succeeded: data.progress.succeeded,
                failed: data.progress.failed,
                skipped: data.progress.skipped,
              },
            },
          };
        });
      }
    } catch (e) {
      console.error("Progress poll error:", e);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  // Auto-refresh while batch is running - ultra-fast polling
  useEffect(() => {
    if (!autoRefresh || !status || status.batch.status === "completed") {
      return;
    }

    // Poll progress every 500ms for real-time updates (lightweight endpoint)
    const interval = setInterval(fetchProgress, 500);
    return () => clearInterval(interval);
  }, [autoRefresh, status?.batch.status]);

  if (loading) {
    return (
      <div className="bg-white border border-black/10 rounded-2xl p-6 text-center">
        <Loader2 className="animate-spin mx-auto mb-3 text-accent" size={32} />
        <p className="text-black/60">Loading batch progress...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-black/10 rounded-2xl p-6">
        <div className="flex gap-3 text-[#b3452c]">
          <AlertCircle size={24} className="flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Error loading batch</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const { batch, progress } = status;
  const isCompleted = batch.status === "completed";
  const isCancelled = batch.status === "cancelled";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-black/10 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-ink">
              Batch Processing
            </h1>
            <p className="text-black/60 text-sm">
              {batch.submittedCount} jobs submitted
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-accent">
              {progress.percentage}%
            </div>
            <p className="text-xs text-black/40">
              {progress.completed} of {progress.total}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-black/10 rounded-full h-3 overflow-hidden mb-4">
          <div
            className="bg-accent h-full transition-all duration-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        {/* Status message */}
        <div className="flex items-center gap-2 text-sm">
          {isCompleted && (
            <div className="flex items-center gap-2 text-accent">
              <CheckCircle size={16} />
              <span>Processing complete</span>
            </div>
          )}
          {isCancelled && (
            <div className="flex items-center gap-2 text-[#b3452c]">
              <XCircle size={16} />
              <span>Batch cancelled</span>
            </div>
          )}
          {!isCompleted && !isCancelled && (
            <div className="flex items-center gap-2 text-black/60">
              <Loader2 size={16} className="animate-spin" />
              <span>
                {progress.stats.queued > 0
                  ? `${progress.stats.queued} queued, processing...`
                  : progress.completed === 0
                    ? "Starting processing..."
                    : `${progress.stats.succeeded + progress.stats.failed} completed, processing...`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {progress.stats.queued > 0 && (
          <StatCard
            label="Queued"
            value={progress.stats.queued}
            color="text-black/40"
            bgColor="bg-black/5"
          />
        )}
        {progress.stats.fetching > 0 && (
          <StatCard
            label="Fetching"
            value={progress.stats.fetching}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
        )}
        <StatCard
          label="Succeeded"
          value={progress.stats.succeeded}
          color="text-accent"
          bgColor="bg-accentLight"
        />
        {progress.stats.failed > 0 && (
          <StatCard
            label="Failed"
            value={progress.stats.failed}
            color="text-[#b3452c]"
            bgColor="bg-[#fdf1ea]"
          />
        )}
        {progress.stats.skipped > 0 && (
          <StatCard
            label="Skipped"
            value={progress.stats.skipped}
            color="text-[#8a6d1f]"
            bgColor="bg-[#fdf6e3]"
          />
        )}
      </div>

      {/* Failed jobs */}
      {status.failures.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
              <XCircle size={20} className="text-[#b3452c]" />
              Failed Jobs
            </h2>
            <button
              onClick={async () => {
                const res = await fetch(
                  `/api/batch/${batchId}?action=retry`,
                  { method: "POST" }
                );
                if (res.ok) {
                  setAutoRefresh(true);
                  fetchStatus();
                }
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors flex items-center gap-1.5"
            >
              <RotateCw size={12} />
              Retry all
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {status.failures.map((failure, idx) => (
              <div key={idx} className="text-sm border-t border-black/5 pt-2">
                <a
                  href={failure.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline truncate block font-mono text-xs mb-0.5"
                >
                  {failure.url}
                </a>
                <p className="text-xs text-black/60">
                  <span className="font-medium">{failure.reason}:</span>{" "}
                  {failure.error}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!isCompleted && !isCancelled && (
        <div className="bg-white border border-black/10 rounded-2xl p-6">
          <div className="flex gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border border-black/20"
              />
              <span>Auto-refresh</span>
            </label>
            <button
              onClick={fetchStatus}
              className="text-sm px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors"
            >
              Refresh now
            </button>
            <button
              onClick={async () => {
                const res = await fetch(
                  `/api/batch/${batchId}?action=cancel`,
                  { method: "POST" }
                );
                if (res.ok) {
                  fetchStatus();
                }
              }}
              className="text-sm px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 text-[#b3452c] transition-colors"
            >
              Cancel batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} border border-black/10 rounded-lg p-4`}>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-black/40">
        {label}
      </div>
    </div>
  );
}
