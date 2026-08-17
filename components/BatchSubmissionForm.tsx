"use client";

import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle, Copy } from "lucide-react";
import { useRouter } from "next/navigation";

interface BatchSubmissionProps {
  onBatchCreated?: (batchId: string) => void;
}

export default function BatchSubmissionForm({
  onBatchCreated,
}: BatchSubmissionProps) {
  const router = useRouter();
  const [urls, setUrls] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function handleSubmit() {
    if (!urls.trim()) {
      setError("Please enter at least one URL");
      return;
    }

    // Parse URLs (split by newline or comma)
    const urlList = urls
      .split(/[\n,]/g)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urlList.length > 100) {
      setError("Maximum 100 URLs per batch");
      return;
    }

    if (urlList.length === 0) {
      setError("Please enter at least one URL");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: urlList }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit batch");
      }

      setResult(data);
      setUrls("");
      onBatchCreated?.(data.batch.id);

      // Redirect immediately - processing already started in background
      router.push(`/batch/${data.batch.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit batch");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="bg-white border border-black/10 rounded-2xl p-6">
        <div className="flex gap-3 mb-4">
          <CheckCircle className="text-accent flex-shrink-0" size={24} />
          <div>
            <h3 className="font-semibold text-ink">Batch submitted!</h3>
            <p className="text-sm text-black/60">
              {result.batch.submittedCount} URLs queued for processing
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-center text-sm">
          <div>
            <div className="font-semibold text-accent">
              {result.batch.submittedCount}
            </div>
            <div className="text-xs text-black/40">Valid URLs</div>
          </div>
          {result.batch.duplicateCount > 0 && (
            <div>
              <div className="font-semibold text-[#8a6d1f]">
                {result.batch.duplicateCount}
              </div>
              <div className="text-xs text-black/40">Duplicates</div>
            </div>
          )}
          {result.batch.invalidCount > 0 && (
            <div>
              <div className="font-semibold text-[#b3452c]">
                {result.batch.invalidCount}
              </div>
              <div className="text-xs text-black/40">Invalid</div>
            </div>
          )}
        </div>

        <p className="text-xs text-black/40">
          Redirecting to batch progress page...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-ink mb-4">
        Bulk Job Processing
      </h2>

      {error && (
        <div className="mb-4 bg-[#fdf1ea] border border-[#b3452c]/20 text-[#b3452c] text-sm rounded-xl p-3.5 flex gap-2">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block mb-1.5">
            <span className="text-xs uppercase tracking-wide text-black/40 font-medium">
              Job URLs (up to 100)
            </span>
          </label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="Paste one URL per line:&#10;https://example.com/job/123&#10;https://example.com/job/456&#10;https://example.com/job/789"
            rows={8}
            className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm bg-[#fcfcfb] focus:border-accent transition-colors font-mono"
            disabled={submitting}
          />
          <p className="text-xs text-black/40 mt-1.5">
            Enter one URL per line, or paste a comma-separated list
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-accent text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting batch...
              </>
            ) : (
              "Submit Batch"
            )}
          </button>
          <button
            onClick={() => setUrls("")}
            disabled={submitting}
            className="px-4 py-3 rounded-xl text-sm font-medium border border-black/10 hover:bg-black/5 transition-colors disabled:opacity-50"
          >
            Clear
          </button>
        </div>

        <div className="p-3 bg-accentLight rounded-lg text-xs text-accent">
          <p className="font-medium mb-1">💡 Tips:</p>
          <ul className="space-y-0.5 text-accent/80">
            <li>• Works with LinkedIn, Indeed, Lever, Greenhouse, and more</li>
            <li>• Protected sites (requiring login) will be marked as failed</li>
            <li>• Duplicates detected automatically</li>
            <li>• Failed jobs can be retried</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
