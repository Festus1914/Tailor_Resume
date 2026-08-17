import { Plus, Trash2 } from "lucide-react";
import type { ResumeCertification } from "@/lib/types";

interface CertificationsSectionProps {
  certifications: ResumeCertification[];
  onChange: (certifications: ResumeCertification[]) => void;
}

export default function CertificationsSection({
  certifications,
  onChange,
}: CertificationsSectionProps) {
  const addCertification = () => {
    onChange([
      ...certifications,
      { name: "", issuer: "", date: "" },
    ]);
  };

  const updateCertification = (
    index: number,
    field: keyof ResumeCertification,
    value: string
  ) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeCertification = (index: number) => {
    onChange(certifications.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Certifications</h2>
        <button
          onClick={addCertification}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium"
        >
          <Plus size={14} />
          Add certification
        </button>
      </div>

      <div className="space-y-3">
        {certifications.map((cert, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <input
              type="text"
              value={cert.name}
              onChange={(e) =>
                updateCertification(idx, "name", e.target.value)
              }
              placeholder="Certification name"
              className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
            />
            <input
              type="text"
              value={cert.issuer}
              onChange={(e) =>
                updateCertification(idx, "issuer", e.target.value)
              }
              placeholder="Issuer"
              className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
            />
            <input
              type="text"
              value={cert.date}
              onChange={(e) =>
                updateCertification(idx, "date", e.target.value)
              }
              placeholder="Date"
              className="w-32 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
            />
            <button
              onClick={() => removeCertification(idx)}
              className="text-black/40 hover:text-black/60 p-2 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {certifications.length === 0 && (
          <div className="text-center py-8 text-black/40">
            <p className="text-sm mb-3">No certifications yet</p>
            <button
              onClick={addCertification}
              className="text-xs text-accent hover:text-accent/80 font-medium"
            >
              Add your first certification
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
