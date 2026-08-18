"use client";

import { useState } from "react";
import { Download, Loader2, Check } from "lucide-react";
import type { ITailoredResume } from "@/lib/models";
import type { IJob } from "@/lib/models";

interface TailorResultsViewProps {
  tailored: ITailoredResume;
  job: IJob;
}

type Tab = "resume" | "coverLetter" | "analysis";

export default function TailorResultsView({
  tailored,
  job,
}: TailorResultsViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("resume");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const matchScore = tailored.analysis?.matchScore || 0;
  const matchColor =
    matchScore >= 80
      ? "text-accent"
      : matchScore >= 60
        ? "text-[#8a6d1f]"
        : "text-[#b3452c]";

  function convertResumeToText(): string {
    console.log("[CONVERT] Starting conversion, tailored object:", {
      hasCurrent: !!tailored.current,
      hasGenerated: !!tailored.generated,
      hasProfileSnapshot: !!tailored.profileSnapshot,
      currentResumeKeys: tailored.current?.resume ? Object.keys(tailored.current.resume).length : 0,
      generatedResumeKeys: tailored.generated?.resume ? Object.keys(tailored.generated.resume).length : 0,
      profileSnapshotKeys: tailored.profileSnapshot ? Object.keys(tailored.profileSnapshot).length : 0,
    });

    // Try current first (user-edited), then generated
    let resume = tailored.current?.resume;
    let source = "current";

    if (!resume || (typeof resume === 'object' && Object.keys(resume).length === 0)) {
      console.log("[CONVERT] Current resume empty, trying generated");
      resume = tailored.generated?.resume;
      source = "generated";
    }

    if (!resume || (typeof resume === 'object' && Object.keys(resume).length === 0)) {
      console.log("[CONVERT] Generated resume empty, trying profileSnapshot");
      resume = tailored.profileSnapshot;
      source = "profileSnapshot";
    }

    if (!resume || (typeof resume === 'object' && Object.keys(resume).length === 0)) {
      console.error("[CONVERT] All resume sources are empty/missing:", {
        hasCurrent: !!tailored.current,
        hasGenerated: !!tailored.generated,
        hasProfileSnapshot: !!tailored.profileSnapshot,
        currentEmpty: tailored.current?.resume ? Object.keys(tailored.current.resume).length === 0 : "missing",
        generatedEmpty: tailored.generated?.resume ? Object.keys(tailored.generated.resume).length === 0 : "missing",
        profileEmpty: tailored.profileSnapshot ? Object.keys(tailored.profileSnapshot).length === 0 : "missing",
      });
      return "";
    }

    console.log("[CONVERT] Using resume source:", source);

    const lines: string[] = [];

    // Safely extract resume data with better error handling
    try {
      const header = resume.header || {};
      const hasHeader = header.fullName || header.headline || header.email || header.phone || header.location;

      console.log("[CONVERT] Resume structure:", {
        source,
        hasHeader,
        hasSummary: !!resume.summary,
        experienceCount: Array.isArray(resume.experience) ? resume.experience.length : 0,
        skillsCount: Array.isArray(resume.skills) ? resume.skills.length : 0,
        educationCount: Array.isArray(resume.education) ? resume.education.length : 0,
      });

      // Header section
      if (header.fullName) {
        lines.push(header.fullName.toUpperCase());
      }
      if (header.headline) {
        lines.push(header.headline);
      }

      // Contact info
      const contactInfo = [
        header.email,
        header.phone,
        header.location,
      ]
        .filter(Boolean)
        .join(" | ");
      if (contactInfo) {
        lines.push(contactInfo);
      }

      // Professional summary
      if (resume.summary) {
        lines.push("", "PROFESSIONAL SUMMARY", resume.summary);
      }

      // Experience
      if (Array.isArray(resume.experience) && resume.experience.length > 0) {
        lines.push("", "EXPERIENCE");
        resume.experience.forEach((exp: any) => {
          if (exp.title || exp.company) {
            lines.push(`${exp.title || "Position"}, ${exp.company || "Company"}`);
          }
          if (exp.startDate || exp.endDate) {
            const endDate = exp.isCurrent ? "Present" : exp.endDate || "Current";
            lines.push(`${exp.startDate || "Start"} - ${endDate}`);
          }
          if (exp.bullets && Array.isArray(exp.bullets)) {
            exp.bullets.forEach((bullet: any) => {
              if (bullet) lines.push(`• ${bullet}`);
            });
          }
          lines.push("");
        });
      }

      // Skills
      if (Array.isArray(resume.skills) && resume.skills.length > 0) {
        lines.push("", "SKILLS");
        resume.skills.forEach((group: any) => {
          const skillsStr = Array.isArray(group.items)
            ? group.items.join(", ")
            : String(group.items || "");
          if (skillsStr) {
            lines.push(`${group.label || "Skills"}: ${skillsStr}`);
          }
        });
      }

      // Education
      if (Array.isArray(resume.education) && resume.education.length > 0) {
        lines.push("", "EDUCATION");
        resume.education.forEach((edu: any) => {
          if (edu.degree && edu.field) {
            lines.push(`${edu.degree} in ${edu.field}`);
          }
          if (edu.school) {
            lines.push(edu.school);
          }
          if (edu.location) {
            lines.push(edu.location);
          }
          lines.push("");
        });
      }

      const result = lines.join("\n").trim();
      console.log("[CONVERT] Final result length:", result.length, "characters");

      if (result.length === 0) {
        console.warn("[CONVERT] Result is empty even after trying all sections");
      }

      return result;
    } catch (error) {
      console.error("[CONVERT] Error during conversion:", error);
      return "";
    }
  }

  // Extract resume content with multiple fallback strategies
  function getResumeContent(): string {
    // First try the structured conversion
    let content = convertResumeToText();

    if (content && content.length > 0) {
      console.log("[RESUME_CONTENT] Using structured conversion, length:", content.length);
      return content;
    }

    console.warn("[RESUME_CONTENT] Structured conversion returned empty, trying fallback methods");

    // Fallback 1: Try to extract from current resume object directly
    if (tailored.current?.resume) {
      console.log("[RESUME_CONTENT] Trying raw current resume JSON");
      content = JSON.stringify(tailored.current.resume, null, 2);
      if (content.length > 10) {
        return content;
      }
    }

    // Fallback 2: Try generated resume
    if (tailored.generated?.resume) {
      console.log("[RESUME_CONTENT] Trying raw generated resume JSON");
      content = JSON.stringify(tailored.generated.resume, null, 2);
      if (content.length > 10) {
        return content;
      }
    }

    // Fallback 3: Try profileSnapshot
    if (tailored.profileSnapshot) {
      console.log("[RESUME_CONTENT] Trying raw profileSnapshot JSON");
      content = JSON.stringify(tailored.profileSnapshot, null, 2);
      if (content.length > 10) {
        return content;
      }
    }

    // Fallback 4: At least return something with the job info
    console.error("[RESUME_CONTENT] All methods failed, creating emergency resume");
    return `Resume for ${job.title} at ${job.company}\n\n${job.descriptionText || "No description available"}`;
  }

  const resumeContent = getResumeContent();
  const coverLetterContent = tailored.current?.coverLetter || "";

  async function downloadFile(format: "pdf" | "docx", content: string) {
    console.log(`[EXPORT] Starting ${format} export, content length:`, content?.length || 0);

    if (!content || content.trim().length === 0) {
      const msg = activeTab === "coverLetter"
        ? "No cover letter available. Please make sure it was generated."
        : "No resume content available. Please refresh the page and try again.";
      alert(msg);
      console.warn(`[EXPORT] Empty content for ${format}:`, msg);
      console.log("[EXPORT] Debug info:", {
        currentResume: !!tailored.current?.resume,
        generatedResume: !!tailored.generated?.resume,
        profileSnapshot: !!tailored.profileSnapshot,
        activeTab,
      });
      return;
    }

    setDownloading(format);

    try {
      const payload = {
        content: content.trim(),
        title: `${job.title} - ${job.company}`,
      };

      console.log(`[EXPORT] Sending ${format} request with ${payload.content.length} chars`);

      const res = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log(`[EXPORT] Response: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          const text = await res.text().catch(() => "");
          if (text) errorMessage = text.substring(0, 200);
        }
        console.error(`[EXPORT] Error:`, errorMessage);
        throw new Error(errorMessage);
      }

      const blob = await res.blob();
      console.log(`[EXPORT] Downloaded ${blob.size} bytes`);

      if (blob.size === 0) {
        throw new Error("Export created empty file. Please try again.");
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tailored-${activeTab === "coverLetter" ? "cover-letter" : "resume"}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error(`[EXPORT] Failed:`, msg);
      alert(`Download failed: ${msg}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-black/10 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-serif font-bold text-ink">
              {job.title}
            </h2>
            <p className="text-black/60">at {job.company}</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${matchColor}`}>
              {matchScore}%
            </div>
            <p className="text-xs text-black/40">Match Score</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              downloadFile(
                "pdf",
                activeTab === "coverLetter" ? coverLetterContent : resumeContent
              )
            }
            disabled={downloading !== null}
            className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {downloading === "pdf" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Exporting...
              </>
            ) : downloadSuccess ? (
              <>
                <Check size={14} />
                Downloaded
              </>
            ) : (
              <>
                <Download size={14} />
                PDF
              </>
            )}
          </button>
          <button
            onClick={() =>
              downloadFile(
                "docx",
                activeTab === "coverLetter" ? coverLetterContent : resumeContent
              )
            }
            disabled={downloading !== null}
            className="px-4 py-2 text-sm rounded-lg border border-black/10 text-black hover:bg-black/5 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {downloading === "docx" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={14} />
                DOCX
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
        <div className="flex border-b border-black/10">
          <button
            onClick={() => setActiveTab("resume")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "resume"
                ? "text-accent border-b-2 border-accent -mb-[2px]"
                : "text-black/60 hover:text-black"
            }`}
          >
            Tailored Resume
          </button>
          <button
            onClick={() => setActiveTab("coverLetter")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "coverLetter"
                ? "text-accent border-b-2 border-accent -mb-[2px]"
                : "text-black/60 hover:text-black"
            }`}
          >
            Cover Letter
          </button>
          <button
            onClick={() => setActiveTab("analysis")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "analysis"
                ? "text-accent border-b-2 border-accent -mb-[2px]"
                : "text-black/60 hover:text-black"
            }`}
          >
            Analysis
          </button>
        </div>

        <div className="p-6">
          {activeTab === "resume" && (
            <ResumePreview resume={tailored.current?.resume} />
          )}
          {activeTab === "coverLetter" && (
            <CoverLetterPreview
              coverLetter={tailored.current?.coverLetter || ""}
            />
          )}
          {activeTab === "analysis" && (
            <AnalysisView analysis={tailored.analysis} />
          )}
        </div>
      </div>

      {/* Token usage info */}
      <div className="text-xs text-black/40 text-center">
        Generated with {tailored.usage?.inputTokens || 0} input tokens,{" "}
        {tailored.usage?.outputTokens || 0} output tokens
      </div>
    </div>
  );
}

function ResumePreview({ resume }: { resume: any }) {
  if (!resume) return <p className="text-black/40">No resume generated</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="text-center pb-4 border-b border-black/10">
        <h1 className="text-xl font-bold">{resume.header?.fullName}</h1>
        {resume.header?.headline && (
          <p className="text-sm text-black/60">{resume.header.headline}</p>
        )}
        {(resume.header?.email ||
          resume.header?.phone ||
          resume.header?.location) && (
          <p className="text-xs text-black/40">
            {[resume.header.email, resume.header.phone, resume.header.location]
              .filter(Boolean)
              .join(" | ")}
          </p>
        )}
      </div>

      {/* Summary */}
      {resume.summary && (
        <div>
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-1">
            Professional Summary
          </h2>
          <p className="text-sm text-black/70">{resume.summary}</p>
        </div>
      )}

      {/* Experience */}
      {resume.experience?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">
            Experience
          </h2>
          {resume.experience.map((exp: any, idx: number) => (
            <div key={idx} className="mb-3 pb-3 border-b border-black/5 last:border-0">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium text-sm">{exp.title}</p>
                  <p className="text-xs text-black/60">{exp.company}</p>
                </div>
                <p className="text-xs text-black/40 whitespace-nowrap">
                  {exp.startDate} -{" "}
                  {exp.isCurrent ? "Present" : exp.endDate}
                </p>
              </div>
              {exp.bullets?.map((bullet: string, bidx: number) => (
                <p key={bidx} className="text-sm text-black/70 mt-1">
                  • {bullet}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {resume.skills?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">
            Skills
          </h2>
          {resume.skills.map((group: any, idx: number) => (
            <p key={idx} className="text-sm text-black/70 mb-1">
              <span className="font-medium">{group.label}:</span>{" "}
              {group.items?.join(", ")}
            </p>
          ))}
        </div>
      )}

      {/* Education */}
      {resume.education?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">
            Education
          </h2>
          {resume.education.map((edu: any, idx: number) => (
            <div key={idx} className="mb-2 pb-2 border-b border-black/5 last:border-0">
              <p className="font-medium text-sm">
                {edu.degree} in {edu.field}
              </p>
              <p className="text-xs text-black/60">{edu.school}</p>
              {edu.location && (
                <p className="text-xs text-black/40">{edu.location}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CoverLetterPreview({ coverLetter }: { coverLetter: string }) {
  return (
    <div className="max-w-2xl mx-auto">
      {coverLetter ? (
        <div className="prose prose-sm max-w-none">
          <p className="text-sm text-black/70 whitespace-pre-wrap leading-relaxed">
            {coverLetter}
          </p>
        </div>
      ) : (
        <p className="text-black/40">No cover letter generated</p>
      )}
    </div>
  );
}

function AnalysisView({ analysis }: { analysis: any }) {
  if (!analysis) return <p className="text-black/40">No analysis available</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Match Score */}
      <div className="p-4 bg-accentLight rounded-lg">
        <p className="text-xs uppercase tracking-wide text-black/40 font-medium mb-2">
          Overall Match
        </p>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold text-accent">
            {analysis.matchScore}%
          </div>
          <p className="text-sm text-black/60">Match with job requirements</p>
        </div>
      </div>

      {/* Matched Keywords */}
      {analysis.matchedKeywords?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            ✓ Matched Keywords
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.matchedKeywords.map(
              (keyword: string, idx: number) => (
                <span
                  key={idx}
                  className="text-xs px-2.5 py-1 rounded-full bg-accentLight text-accent border border-accent/20"
                >
                  {keyword}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Missing Keywords */}
      {analysis.missingKeywords?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            Not Yet Covered
          </h3>
          <p className="text-xs text-black/60 mb-2">
            These job requirements aren't yet reflected in your resume.
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.missingKeywords.map(
              (keyword: string, idx: number) => (
                <span
                  key={idx}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#fdf1ea] text-[#b3452c] border border-[#b3452c]/20"
                >
                  {keyword}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Summary of Changes */}
      {analysis.summaryOfChanges?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">
            Changes Made
          </h3>
          <ul className="space-y-2">
            {analysis.summaryOfChanges.map(
              (change: string, idx: number) => (
                <li
                  key={idx}
                  className="text-sm text-black/70 flex gap-2"
                >
                  <span className="text-accent">✓</span>
                  {change}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
