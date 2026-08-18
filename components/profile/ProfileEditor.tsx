"use client";

import { useState } from "react";
import { Save, Loader2, AlertCircle, Upload } from "lucide-react";
import type { ResumeDocument } from "@/lib/types";
import HeaderSection from "./sections/HeaderSection";
import SummarySection from "./sections/SummarySection";
import ExperienceSection from "./sections/ExperienceSection";
import SkillsSection from "./sections/SkillsSection";
import EducationSection from "./sections/EducationSection";
import CertificationsSection from "./sections/CertificationsSection";
import ProjectsSection from "./sections/ProjectsSection";

interface ProfileEditorProps {
  initialProfile: {
    id: string;
    userId: string;
    masterResume: ResumeDocument;
    rawText: string;
  };
}

export default function ProfileEditor({ initialProfile }: ProfileEditorProps) {
  const [resume, setResume] = useState<ResumeDocument>(
    initialProfile.masterResume
  );
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      console.log("[UPLOAD] Starting file upload:", { name: file.name, type: file.type, size: file.size });

      const res = await fetch("/api/profile/parse-cv", {
        method: "POST",
        body: formData,
      });

      console.log("[UPLOAD] Response status:", res.status, res.statusText);

      let data;
      try {
        data = await res.json();
        console.log("[UPLOAD] Response data:", data);
      } catch (parseError) {
        console.error("[UPLOAD] Failed to parse response as JSON:", parseError);
        const text = await res.text();
        console.error("[UPLOAD] Response text:", text);
        throw new Error(`Server error (${res.status}): ${text.substring(0, 200)}`);
      }

      if (!res.ok) {
        const errorMsg = data?.error ?? data?.message ?? `Failed to parse resume (${res.status})`;
        console.error("[UPLOAD] Error response:", errorMsg);
        throw new Error(errorMsg);
      }

      console.log("[UPLOAD] Success! Setting resume data");
      setResume(data.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to parse resume";
      console.error("[UPLOAD] Error:", errorMessage);
      setError(errorMessage);
    } finally {
      setParsing(false);
      event.target.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterResume: resume,
          rawText: initialProfile.rawText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save profile");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="bg-[#fdf1ea] border border-[#b3452c]/20 text-[#b3452c] text-sm rounded-xl p-3.5 flex gap-2"
        >
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-accentLight border border-accent/20 text-accent text-sm rounded-xl p-3.5">
          ✓ {parsing ? "Resume parsed successfully" : "Profile saved successfully"}
        </div>
      )}

      {/* CV Upload Section */}
      <div className="bg-white border border-black/10 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-ink mb-1">
              Import from CV
            </h2>
            <p className="text-sm text-black/50">
              Upload your resume to auto-populate all fields
            </p>
          </div>
        </div>

        <label className="block">
          <div className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-black/10 rounded-lg hover:border-accent/30 transition-colors cursor-pointer bg-black/2">
            <div className="text-center">
              <Upload size={24} className="text-black/40 mx-auto mb-2" />
              <p className="text-sm font-medium text-ink">
                {parsing ? "Parsing resume..." : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-black/40 mt-1">Supported: PDF, DOCX, or TXT</p>
            </div>
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileUpload}
              disabled={parsing}
              className="hidden"
            />
          </div>
        </label>
      </div>

      {/* Personal Info */}
      <HeaderSection
        header={resume.header}
        onChange={(header) => setResume({ ...resume, header })}
      />

      {/* Professional Summary */}
      <SummarySection
        summary={resume.summary}
        onChange={(summary) => setResume({ ...resume, summary })}
      />

      {/* Experience */}
      <ExperienceSection
        experience={resume.experience}
        onChange={(experience) => setResume({ ...resume, experience })}
      />

      {/* Skills */}
      <SkillsSection
        skills={resume.skills}
        onChange={(skills) => setResume({ ...resume, skills })}
      />

      {/* Education */}
      <EducationSection
        education={resume.education}
        onChange={(education) => setResume({ ...resume, education })}
      />

      {/* Certifications */}
      <CertificationsSection
        certifications={resume.certifications}
        onChange={(certifications) => setResume({ ...resume, certifications })}
      />

      {/* Projects */}
      <ProjectsSection
        projects={resume.projects}
        onChange={(projects) => setResume({ ...resume, projects })}
      />

      {/* Save Button */}
      <div className="flex gap-3 pt-6 border-t border-black/10">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
