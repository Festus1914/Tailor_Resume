import { Plus, X, Trash2 } from "lucide-react";
import type { ResumeProject } from "@/lib/types";

interface ProjectsSectionProps {
  projects: ResumeProject[];
  onChange: (projects: ResumeProject[]) => void;
}

export default function ProjectsSection({
  projects,
  onChange,
}: ProjectsSectionProps) {
  const addProject = () => {
    onChange([
      ...projects,
      { name: "", description: "", bullets: [], url: "" },
    ]);
  };

  const updateProject = (
    index: number,
    field: keyof ResumeProject,
    value: unknown
  ) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addBullet = (index: number) => {
    const updated = [...projects];
    updated[index].bullets = [...updated[index].bullets, ""];
    onChange(updated);
  };

  const updateBullet = (
    projIndex: number,
    bulletIndex: number,
    value: string
  ) => {
    const updated = [...projects];
    updated[projIndex].bullets[bulletIndex] = value;
    onChange(updated);
  };

  const removeBullet = (projIndex: number, bulletIndex: number) => {
    const updated = [...projects];
    updated[projIndex].bullets = updated[projIndex].bullets.filter(
      (_, i) => i !== bulletIndex
    );
    onChange(updated);
  };

  const removeProject = (index: number) => {
    onChange(projects.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Projects</h2>
        <button
          onClick={addProject}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium"
        >
          <Plus size={14} />
          Add project
        </button>
      </div>

      <div className="space-y-6">
        {projects.map((project, idx) => (
          <div
            key={idx}
            className="pb-6 border-b border-black/10 last:pb-0 last:border-0"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <input
                  type="text"
                  value={project.name}
                  onChange={(e) => updateProject(idx, "name", e.target.value)}
                  placeholder="Project name"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors font-semibold sm:col-span-2"
                />
                <textarea
                  value={project.description}
                  onChange={(e) =>
                    updateProject(idx, "description", e.target.value)
                  }
                  placeholder="Project description"
                  rows={2}
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors sm:col-span-2"
                />
                <input
                  type="url"
                  value={project.url}
                  onChange={(e) => updateProject(idx, "url", e.target.value)}
                  placeholder="Project URL (optional)"
                  className="border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors sm:col-span-2"
                />
              </div>
              <button
                onClick={() => removeProject(idx)}
                className="text-black/40 hover:text-black/60 p-2 -mr-2 transition-colors flex-shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Bullets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs uppercase tracking-wide text-black/40 font-medium">
                  Details
                </h4>
                <button
                  onClick={() => addBullet(idx)}
                  className="text-xs text-accent hover:text-accent/80 font-medium"
                >
                  <Plus size={12} className="inline mr-1" />
                  Add detail
                </button>
              </div>
              <div className="space-y-2">
                {project.bullets.map((bullet, bIdx) => (
                  <div key={bIdx} className="flex gap-2">
                    <span className="text-black/30 text-sm pt-2">•</span>
                    <input
                      type="text"
                      value={bullet}
                      onChange={(e) =>
                        updateBullet(idx, bIdx, e.target.value)
                      }
                      placeholder="Project detail or achievement"
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

        {projects.length === 0 && (
          <div className="text-center py-8 text-black/40">
            <p className="text-sm mb-3">No projects yet</p>
            <button
              onClick={addProject}
              className="text-xs text-accent hover:text-accent/80 font-medium"
            >
              Add your first project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
