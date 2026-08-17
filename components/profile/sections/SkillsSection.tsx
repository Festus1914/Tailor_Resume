import { Plus, X, Trash2 } from "lucide-react";
import type { ResumeSkillGroup } from "@/lib/types";

interface SkillsSectionProps {
  skills: ResumeSkillGroup[];
  onChange: (skills: ResumeSkillGroup[]) => void;
}

export default function SkillsSection({
  skills,
  onChange,
}: SkillsSectionProps) {
  const addGroup = () => {
    onChange([...skills, { label: "", items: [] }]);
  };

  const updateGroup = (index: number, field: keyof ResumeSkillGroup, value: unknown) => {
    const updated = [...skills];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addSkill = (groupIndex: number) => {
    const updated = [...skills];
    updated[groupIndex].items = [...updated[groupIndex].items, ""];
    onChange(updated);
  };

  const updateSkill = (groupIndex: number, skillIndex: number, value: string) => {
    const updated = [...skills];
    updated[groupIndex].items[skillIndex] = value;
    onChange(updated);
  };

  const removeSkill = (groupIndex: number, skillIndex: number) => {
    const updated = [...skills];
    updated[groupIndex].items = updated[groupIndex].items.filter(
      (_, i) => i !== skillIndex
    );
    onChange(updated);
  };

  const removeGroup = (index: number) => {
    onChange(skills.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Skills</h2>
        <button
          onClick={addGroup}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium"
        >
          <Plus size={14} />
          Add group
        </button>
      </div>

      <div className="space-y-6">
        {skills.map((group, idx) => (
          <div
            key={idx}
            className="pb-6 border-b border-black/10 last:pb-0 last:border-0"
          >
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={group.label}
                onChange={(e) => updateGroup(idx, "label", e.target.value)}
                placeholder="Category (e.g., Languages, Tools)"
                className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors font-semibold"
              />
              <button
                onClick={() => removeGroup(idx)}
                className="text-black/40 hover:text-black/60 p-2 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {group.items.map((skill, sIdx) => (
                <div key={sIdx} className="flex gap-2">
                  <input
                    type="text"
                    value={skill}
                    onChange={(e) => updateSkill(idx, sIdx, e.target.value)}
                    placeholder="Skill"
                    className="border border-black/10 rounded-full px-3 py-1.5 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
                  />
                  <button
                    onClick={() => removeSkill(idx, sIdx)}
                    className="text-black/40 hover:text-black/60 p-1 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addSkill(idx)}
                className="text-xs text-accent hover:text-accent/80 font-medium px-3 py-1.5"
              >
                <Plus size={12} className="inline mr-1" />
                Add skill
              </button>
            </div>
          </div>
        ))}

        {skills.length === 0 && (
          <div className="text-center py-8 text-black/40">
            <p className="text-sm mb-3">No skills yet</p>
            <button
              onClick={addGroup}
              className="text-xs text-accent hover:text-accent/80 font-medium"
            >
              Add your first skill group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
