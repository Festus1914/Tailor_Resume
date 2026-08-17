import { Plus, X, Trash2 } from "lucide-react";
import type { ResumeExperience } from "@/lib/types";

interface ExperienceSectionProps {
  experience: ResumeExperience[];
  onChange: (experience: ResumeExperience[]) => void;
}

export default function ExperienceSection({
  experience,
  onChange,
}: ExperienceSectionProps) {
  const addExperience = () => {
    onChange([
      ...experience,
      {
        company: "",
        title: "",
        location: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        companyDescription: "",
        bullets: [],
      },
    ]);
  };

  const updateExperience = (
    index: number,
    field: keyof ResumeExperience,
    value: unknown
  ) => {
    const updated = [...experience];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addBullet = (index: number) => {
    const updated = [...experience];
    updated[index].bullets = [...updated[index].bullets, ""];
    onChange(updated);
  };

  const updateBullet = (
    expIndex: number,
    bulletIndex: number,
    value: string
  ) => {
    const updated = [...experience];
    updated[expIndex].bullets[bulletIndex] = value;
    onChange(updated);
  };

  const removeBullet = (expIndex: number, bulletIndex: number) => {
    const updated = [...experience];
    updated[expIndex].bullets = updated[expIndex].bullets.filter(
      (_, i) => i !== bulletIndex
    );
    onChange(updated);
  };

  const removeExperience = (index: number) => {
    onChange(experience.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Experience</h2>
        <button
          onClick={addExperience}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium"
        >
          <Plus size={14} />
          Add role
        </button>
      </div>

      <div className="space-y-6">
        {experience.map((exp, idx) => (
          <div
            key={idx}
            className="pb-6 border-b border-black/10 last:pb-0 last:border-0"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <input
                  type="text"
                  value={exp.company}
                  onChange={(e) => updateExperience(idx, "company", e.target.value)}
                  placeholder="Company name"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors font-semibold"
                />
                <input
                  type="text"
                  value={exp.title}
                  onChange={(e) => updateExperience(idx, "title", e.target.value)}
                  placeholder="Job title"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                />
                <input
                  type="text"
                  value={exp.location}
                  onChange={(e) => updateExperience(idx, "location", e.target.value)}
                  placeholder="Location"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={exp.startDate}
                    onChange={(e) =>
                      updateExperience(idx, "startDate", e.target.value)
                    }
                    placeholder="Start date (e.g., 01/2020)"
                    className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                  />
                  <input
                    type="text"
                    value={exp.isCurrent ? "Present" : exp.endDate}
                    onChange={(e) =>
                      updateExperience(idx, "endDate", e.target.value)
                    }
                    placeholder="End date"
                    disabled={exp.isCurrent}
                    className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors disabled:bg-black/5 disabled:text-black/40"
                  />
                </div>
              </div>
              <button
                onClick={() => removeExperience(idx)}
                className="text-black/40 hover:text-black/60 p-2 -mr-2 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={exp.isCurrent}
                onChange={(e) =>
                  updateExperience(idx, "isCurrent", e.target.checked)
                }
                className="rounded border border-black/20"
              />
              <span className="text-sm text-black/60">Currently working here</span>
            </label>

            <textarea
              value={exp.companyDescription}
              onChange={(e) =>
                updateExperience(idx, "companyDescription", e.target.value)
              }
              placeholder="Company description (optional)"
              rows={2}
              className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors mb-3"
            />

            {/* Bullets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs uppercase tracking-wide text-black/40 font-medium">
                  Achievements
                </h4>
                <button
                  onClick={() => addBullet(idx)}
                  className="text-xs text-accent hover:text-accent/80 font-medium"
                >
                  <Plus size={12} className="inline mr-1" />
                  Add bullet
                </button>
              </div>
              <div className="space-y-2">
                {exp.bullets.map((bullet, bIdx) => (
                  <div key={bIdx} className="flex gap-2">
                    <span className="text-black/30 text-sm pt-2">•</span>
                    <input
                      type="text"
                      value={bullet}
                      onChange={(e) =>
                        updateBullet(idx, bIdx, e.target.value)
                      }
                      placeholder="Achievement or responsibility"
                      className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                    />
                    <button
                      onClick={() => removeBullet(idx, bIdx)}
                      className="text-black/40 hover:text-black/60 p-1 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {experience.length === 0 && (
          <div className="text-center py-8 text-black/40">
            <p className="text-sm mb-3">No work experience yet</p>
            <button
              onClick={addExperience}
              className="text-xs text-accent hover:text-accent/80 font-medium"
            >
              Add your first role
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
