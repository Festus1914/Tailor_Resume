"use client";

import { useState } from "react";
import { Download, Copy, Check, FileText, Mail, ListChecks } from "lucide-react";
import { TailorResult } from "@/lib/types";

interface ResultsTabsProps {
  result: TailorResult;
  onResumeChange: (text: string) => void;
  onCoverLetterChange: (text: string) => void;
  applicantName?: string;
  companyName?: string;
}

type Tab = "resume" | "cover" | "changes";

export default function ResultsTabs({
  result,
  onResumeChange,
  onCoverLetterChange,
  applicantName,
  companyName,
}: ResultsTabsProps) {
  const [tab, setTab] = useState<Tab>("resume");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const activeText =
    (tab === "cover" ? result.coverLetter : result.tailoredResume) ?? "";
  const safeChanges = Array.isArray(result.summaryOfChanges)
    ? result.summaryOfChanges
    : [];

  async function handleCopy() {
    await navigator.clipboard.writeText(activeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleDownload(format: "pdf" | "docx") {
    const isCover = tab === "cover";
    const key = `${tab}-${format}`;
    setDownloading(key);
    try {
      const res = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: activeText,
          name: isCover ? undefined : applicantName,
          title: isCover
            ? `Cover Letter${companyName ? " - " + companyName : ""}`
            : `Resume${companyName ? " - " + companyName : ""}`,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isCover ? "cover-letter" : "tailored-resume"}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Sorry, that download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "resume", label: "Tailored Resume", icon: <FileText size={15} /> },
    { id: "cover", label: "Cover Letter", icon: <Mail size={15} /> },
    { id: "changes", label: "What Changed", icon: <ListChecks size={15} /> },
  ];

  return (
    <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
      <div className="flex border-b border-black/10 bg-[#f6f5f2]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id
                ? "border-accent text-accent bg-white"
                : "border-transparent text-black/50 hover:text-black/80"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "changes" ? (
          <ul className="space-y-2.5">
            {safeChanges.map((change, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-black/80">
                <span className="text-accent mt-0.5">✓</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-black/40">
                Editable — tweak anything before exporting.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => handleDownload("docx")}
                  disabled={downloading !== null}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5 transition-colors disabled:opacity-50"
                >
                  <Download size={13} />
                  {downloading === `${tab}-docx` ? "..." : ".docx"}
                </button>
                <button
                  onClick={() => handleDownload("pdf")}
                  disabled={downloading !== null}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <Download size={13} />
                  {downloading === `${tab}-pdf` ? "..." : ".pdf"}
                </button>
              </div>
            </div>
            <textarea
              value={activeText}
              onChange={(e) =>
                tab === "cover"
                  ? onCoverLetterChange(e.target.value)
                  : onResumeChange(e.target.value)
              }
              className="w-full h-[480px] resize-none text-sm leading-relaxed font-mono bg-[#fcfcfb] border border-black/10 rounded-xl p-4 custom-scroll"
              spellCheck={false}
            />
          </>
        )}
      </div>
    </div>
  );
}
