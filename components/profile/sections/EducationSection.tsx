import { Plus, X, Trash2 } from "lucide-react";
import type { ResumeEducation } from "@/lib/types";

interface EducationSectionProps {
  education: ResumeEducation[];
  onChange: (education: ResumeEducation[]) => void;
}

export default function EducationSection({
  education,
  onChange,
}: EducationSectionProps) {
  const addEducation = () => {
    onChange([
      ...education,
      {
        school: "",
        degree: "",
        field: "",
        startDate: "",
        endDate: "",
        location: "",
        activities: [],
      },
    ]);
  };

  const updateEducation = (
    index: number,
    field: keyof ResumeEducation,
    value: unknown
  ) => {
    const updated = [...education];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addActivity = (index: number) => {
    const updated = [...education];
    updated[index].activities = [...updated[index].activities, ""];
    onChange(updated);
  };

  const updateActivity = (
    eduIndex: number,
    actIndex: number,
    value: string
  ) => {
    const updated = [...education];
    updated[eduIndex].activities[actIndex] = value;
    onChange(updated);
  };

  const removeActivity = (eduIndex: number, actIndex: number) => {
    const updated = [...education];
    updated[eduIndex].activities = updated[eduIndex].activities.filter(
      (_, i) => i !== actIndex
    );
    onChange(updated);
  };

  const removeEducation = (index: number) => {
    onChange(education.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Education</h2>
        <button
          onClick={addEducation}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium"
        >
          <Plus size={14} />
          Add education
        </button>
      </div>

      <div className="space-y-6">
        {education.map((edu, idx) => (
          <div
            key={idx}
            className="pb-6 border-b border-black/10 last:pb-0 last:border-0"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <input
                  type="text"
                  value={edu.school}
                  onChange={(e) => updateEducation(idx, "school", e.target.value)}
                  placeholder="School or university"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors font-semibold"
                />
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) => updateEducation(idx, "degree", e.target.value)}
                  placeholder="Degree (e.g., Bachelor's)"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                />
                <input
                  type="text"
                  value={edu.field}
                  onChange={(e) => updateEducation(idx, "field", e.target.value)}
                  placeholder="Field of study"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                />
                <input
                  type="text"
                  value={edu.location}
                  onChange={(e) => updateEducation(idx, "location", e.target.value)}
                  placeholder="Location"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                />
                <input
                  type="text"
                  value={edu.startDate}
                  onChange={(e) => updateEducation(idx, "startDate", e.target.value)}
                  placeholder="Start date"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                />
                <input
                  type="text"
                  value={edu.endDate}
                  onChange={(e) => updateEducation(idx, "endDate", e.target.value)}
                  placeholder="End date"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                />
              </div>
              <button
                onClick={() => removeEducation(idx)}
                className="text-black/40 hover:text-black/60 p-2 -mr-2 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Activities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs uppercase tracking-wide text-black/40 font-medium">
                  Activities & Societies
                </h4>
                <button
                  onClick={() => addActivity(idx)}
                  className="text-xs text-accent hover:text-accent/80 font-medium"
                >
                  <Plus size={12} className="inline mr-1" />
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {edu.activities.map((activity, aIdx) => (
                  <div key={aIdx} className="flex gap-2">
                    <input
                      type="text"
                      value={activity}
                      onChange={(e) =>
                        updateActivity(idx, aIdx, e.target.value)
                      }
                      placeholder="Activity or society"
                      className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                    />
                    <button
                      onClick={() => removeActivity(idx, aIdx)}
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

        {education.length === 0 && (
          <div className="text-center py-8 text-black/40">
            <p className="text-sm mb-3">No education yet</p>
            <button
              onClick={addEducation}
              className="text-xs text-accent hover:text-accent/80 font-medium"
            >
              Add your first education
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
