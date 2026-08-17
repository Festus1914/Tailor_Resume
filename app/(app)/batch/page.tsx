import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/mongodb";
import { Batch, JobTask } from "@/lib/models";
import BatchSubmissionForm from "@/components/BatchSubmissionForm";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export const metadata: Metadata = { title: "Batch Processing — Resume Tailor" };
export const dynamic = "force-dynamic";

export default async function BatchPage() {
  const { user } = await requireUser();
  await connectToDatabase();

  const [batches, total] = await Promise.all([
    Batch.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50),
    Batch.countDocuments({ userId: user._id }),
  ]);

  // Get task stats for each batch
  const batchesWithStats = await Promise.all(
    batches.map(async (batch) => {
      const tasks = await JobTask.find({ batchId: batch._id });
      const stats = {
        total: tasks.length,
        succeeded: tasks.filter((t) => t.status === "succeeded").length,
        failed: tasks.filter((t) => t.status === "failed").length,
        completed:
          tasks.filter((t) => t.status === "succeeded").length +
          tasks.filter((t) => t.status === "failed").length +
          tasks.filter((t) => t.status === "skipped").length,
      };

      return {
        id: String(batch._id),
        status: batch.status,
        submittedCount: batch.submittedCount,
        stats,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt,
      };
    })
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-ink mb-2">
          Bulk Job Processing
        </h1>
        <p className="text-black/50">
          Submit up to 100 job URLs at once for tailoring in batches.
        </p>
      </header>

      {/* Submission form */}
      <BatchSubmissionForm />

      {/* Batch history */}
      {batchesWithStats.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-ink mb-4">
            Recent Batches
          </h2>

          <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f6f5f2]">
                  <tr className="text-xs uppercase tracking-wide text-black/40">
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Results</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                    <th className="px-4 py-3 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batchesWithStats.map((batch) => {
                    const progress =
                      batch.stats.total > 0
                        ? Math.round(
                            (batch.stats.completed / batch.stats.total) * 100
                          )
                        : 0;

                    return (
                      <tr
                        key={batch.id}
                        className="border-t border-black/5 hover:bg-black/2 transition-colors"
                      >
                        <td className="px-4 py-3">
                          {batch.status === "completed" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accentLight text-accent border border-accent/20">
                              <CheckCircle size={12} />
                              Completed
                            </span>
                          ) : batch.status === "cancelled" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#fdf1ea] text-[#b3452c] border border-[#b3452c]/20">
                              <XCircle size={12} />
                              Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-black/5 text-black/60 border border-black/10">
                              <Loader2 size={12} className="animate-spin" />
                              Running
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className="w-32 bg-black/10 rounded-full h-2 overflow-hidden mb-1">
                              <div
                                className="bg-accent h-full transition-all"
                                style={{
                                  width: `${progress}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-black/40">
                              {batch.stats.completed}/{batch.stats.total}{" "}
                              ({progress}%)
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs space-y-0.5">
                            <p className="text-accent font-medium">
                              ✓ {batch.stats.succeeded}
                            </p>
                            {batch.stats.failed > 0 && (
                              <p className="text-[#b3452c]">✕ {batch.stats.failed}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-black/40">
                          {new Date(batch.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/batch/${batch.id}`}
                            className="text-xs text-accent hover:underline font-medium"
                          >
                            View details →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
