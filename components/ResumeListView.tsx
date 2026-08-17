"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface ResumeSummary {
  id: string;
  job: { title: string; company: string; url: string };
  matchScore: number;
  isEdited: boolean;
  createdAt: Date;
  editedAt: Date | null;
  model: string;
}

interface ResumeListViewProps {
  resumes: ResumeSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentSearch: string;
  currentCompany: string;
  currentStatus: string;
}

export default function ResumeListView({
  resumes,
  total,
  page,
  pageSize,
  totalPages,
  currentSearch,
  currentCompany,
  currentStatus,
}: ResumeListViewProps) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const [company, setCompany] = useState(currentCompany);
  const [status, setStatus] = useState(currentStatus);
  const [deleting, setDeleting] = useState<string | null>(null);

  function updateSearch() {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (company) params.set("company", company);
    if (status !== "all") params.set("status", status);
    params.set("page", "1");
    router.push(`/resumes?${params.toString()}`);
  }

  async function handleDelete(resumeId: string) {
    if (!confirm("Delete this resume? This cannot be undone.")) return;

    setDeleting(resumeId);
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Refresh the page
        router.refresh();
      } else {
        alert("Failed to delete resume");
      }
    } finally {
      setDeleting(null);
    }
  }

  function handleExport(resumeId: string, format: string) {
    const link = document.createElement("a");
    link.href = `/api/resumes/${resumeId}/export?format=${format}`;
    link.download = "resume";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="bg-white border border-black/10 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && updateSearch()}
              placeholder="Search by title or company..."
              className="w-full border border-black/10 rounded-lg pl-9 pr-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={updateSearch}
            className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Search
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-black/10 bg-[#fcfcfb] focus:border-accent"
          >
            <option value="">All companies</option>
            {/* Populate from resumes */}
            {Array.from(new Set(resumes.map((r) => r.job.company))).map(
              (c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              )
            )}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-black/10 bg-[#fcfcfb] focus:border-accent"
          >
            <option value="all">All status</option>
            <option value="edited">Edited</option>
            <option value="unedited">Unedited</option>
          </select>

          {(search || company || status !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setCompany("");
                setStatus("all");
                router.push("/resumes");
              }}
              className="px-3 py-2 text-sm text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Resume table */}
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f6f5f2]">
              <tr className="text-xs uppercase tracking-wide text-black/40">
                <th className="px-4 py-3 text-left font-medium">Job</th>
                <th className="px-4 py-3 text-left font-medium">Match</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resumes.map((resume) => (
                <tr
                  key={resume.id}
                  className="border-t border-black/5 hover:bg-black/2 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/tailor/${resume.id}`}
                      className="block hover:text-accent transition-colors"
                    >
                      <p className="font-medium text-ink">
                        {resume.job.title}
                      </p>
                      <p className="text-xs text-black/60">
                        {resume.job.company}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-black/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-accent h-full"
                          style={{
                            width: `${resume.matchScore}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-accent">
                        {resume.matchScore}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {resume.isEdited ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Edited
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-black/5 text-black/50 border border-black/10">
                        Original
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-black/40">
                    {new Date(resume.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Link
                        href={`/tailor/${resume.id}`}
                        className="p-1.5 text-black/40 hover:text-accent rounded transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </Link>
                      <button
                        onClick={() =>
                          handleExport(resume.id, "pdf")
                        }
                        className="p-1.5 text-black/40 hover:text-accent rounded transition-colors"
                        title="Export PDF"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(resume.id)}
                        disabled={deleting === resume.id}
                        className="p-1.5 text-black/40 hover:text-[#b3452c] rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === resume.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/5 text-xs text-black/40">
            <span>
              Page {page} of {totalPages} · {total} resumes
            </span>
            <div className="flex gap-2">
              <Link
                href={`/resumes?q=${search}&company=${company}&status=${status}&page=${page - 1}`}
                className={`px-3 py-1.5 rounded-full border border-black/10 transition-colors ${
                  page === 1
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-black/5"
                }`}
                style={{
                  pointerEvents: page === 1 ? "none" : "auto",
                }}
              >
                <ChevronLeft size={14} />
              </Link>
              <Link
                href={`/resumes?q=${search}&company=${company}&status=${status}&page=${page + 1}`}
                className={`px-3 py-1.5 rounded-full border border-black/10 transition-colors ${
                  page === totalPages
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-black/5"
                }`}
                style={{
                  pointerEvents: page === totalPages ? "none" : "auto",
                }}
              >
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
