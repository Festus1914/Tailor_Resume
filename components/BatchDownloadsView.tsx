"use client";

import { useState } from "react";
import { Download, FileText, Loader2, Package } from "lucide-react";

interface CompletedResume {
  id: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  createdAt: string;
}

interface BatchDownloadsViewProps {
  batchId: string;
  completedResumes: CompletedResume[];
}

export default function BatchDownloadsView({
  batchId,
  completedResumes,
}: BatchDownloadsViewProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleDownload = async (resumeId: string, format: "pdf" | "docx") => {
    setDownloading(`${resumeId}-${format}`);
    try {
      // First, fetch the resume content
      const resumeRes = await fetch(`/api/resumes/${resumeId}`);
      if (!resumeRes.ok) throw new Error("Failed to fetch resume");

      const resumeData = await resumeRes.json();
      // current/generated are { resume, coverLetter } wrappers — unwrap the document
      const version = resumeData.resume?.current || resumeData.resume?.generated;
      const resumeContent = version?.resume ?? version;

      if (!resumeContent) throw new Error("No resume content found");

      // Format resume content as text for export
      const resumeText = formatResumeForExport(resumeContent);
      if (!resumeText.trim()) {
        throw new Error("Resume content is empty. Open the resume, re-save it, and try again.");
      }
      const filename = `resume-${resumeId.slice(0, 8)}`;

      // POST to export endpoint
      const exportEndpoint = format === "pdf" ? "/api/export/pdf" : "/api/export/docx";
      const exportRes = await fetch(exportEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: resumeText,
          title: filename,
        }),
      });

      if (!exportRes.ok) {
        const error = await exportRes.json().catch(() => ({}));
        throw new Error(error.error || `Export failed with status ${exportRes.status}`);
      }

      const blob = await exportRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert(`Failed to download ${format.toUpperCase()}: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDownloading(null);
    }
  };

  function formatResumeForExport(resume: any): string {
    const lines: string[] = [];

    if (resume?.header?.fullName) {
      lines.push(resume.header.fullName);
    }
    if (resume?.header?.headline) {
      lines.push(resume.header.headline);
    }
    if (resume?.header?.email || resume?.header?.phone || resume?.header?.location) {
      const contact = [
        resume.header.email,
        resume.header.phone,
        resume.header.location,
      ]
        .filter(Boolean)
        .join(" | ");
      if (contact) lines.push(contact);
    }

    if (resume?.summary) {
      lines.push("");
      lines.push("PROFESSIONAL SUMMARY");
      lines.push(resume.summary);
    }

    if (resume?.experience?.length) {
      lines.push("");
      lines.push("WORK EXPERIENCE");
      for (const exp of resume.experience) {
        lines.push(`${exp.title}, ${exp.company}`);
        if (exp.startDate || exp.endDate) {
          lines.push(`${exp.startDate} - ${exp.endDate || "Present"}`);
        }
        if (exp.bullets?.length) {
          for (const bullet of exp.bullets) {
            lines.push(`• ${bullet}`);
          }
        }
      }
    }

    if (resume?.skills?.length) {
      lines.push("");
      lines.push("SKILLS");
      for (const group of resume.skills) {
        const items = Array.isArray(group.items)
          ? group.items.join(", ")
          : String(group.items ?? "");
        lines.push(`${group.label}`);
        if (items) lines.push(items);
      }
    }

    if (resume?.education?.length) {
      lines.push("");
      lines.push("EDUCATION");
      for (const edu of resume.education) {
        lines.push(`${edu.degree}, ${edu.school}`);
        if (edu.startDate || edu.endDate) {
          lines.push(`${edu.startDate} - ${edu.endDate}`);
        }
      }
    }

    return lines.join("\n");
  }

  const handleBulkDownload = async () => {
    setDownloadingZip(true);
    try {
      const response = await fetch(`/api/batch/${batchId}/download-zip`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `batch-resumes.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Bulk download error:", error);
      alert("Failed to download batch as ZIP");
    } finally {
      setDownloadingZip(false);
    }
  };

  if (completedResumes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <Download size={20} className="text-accent" />
            Download Tailored Resumes
          </h2>
          <p className="text-xs text-black/40 mt-1">
            {completedResumes.length} resume{completedResumes.length !== 1 ? "s" : ""} ready for download
          </p>
        </div>
        <button
          onClick={handleBulkDownload}
          disabled={downloadingZip}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {downloadingZip ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Package size={14} />
              Download All as ZIP
            </>
          )}
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {completedResumes.map((resume) => (
          <div
            key={resume.id}
            className="flex items-center justify-between bg-[#f6f5f2] border border-black/5 rounded-lg p-4 hover:border-accent/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText size={16} className="text-black/40 flex-shrink-0" />
                <p className="text-sm font-medium text-ink truncate">
                  {resume.company || "Job"}
                </p>
                {resume.jobTitle && (
                  <p className="text-xs text-black/40 truncate">
                    {resume.jobTitle}
                  </p>
                )}
              </div>
              <p className="text-xs text-black/40">
                Match: {resume.matchScore}%
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleDownload(resume.id, "pdf")}
                disabled={downloading?.startsWith(resume.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading === `${resume.id}-pdf` ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                PDF
              </button>
              <button
                onClick={() => handleDownload(resume.id, "docx")}
                disabled={downloading?.startsWith(resume.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-black/10 text-ink rounded-lg hover:bg-black/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading === `${resume.id}-docx` ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                DOCX
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-black/40 mt-4">
        💡 You can also view and edit each resume individually before downloading
      </p>
    </div>
  );
}
