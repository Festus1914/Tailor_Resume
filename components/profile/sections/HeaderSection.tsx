import { Plus, X } from "lucide-react";
import type { ResumeHeader, ResumeLink } from "@/lib/types";

interface HeaderSectionProps {
  header: ResumeHeader;
  onChange: (header: ResumeHeader) => void;
}

export default function HeaderSection({ header, onChange }: HeaderSectionProps) {
  const updateLink = (index: number, field: keyof ResumeLink, value: string) => {
    const links = [...header.links];
    links[index] = { ...links[index], [field]: value };
    onChange({ ...header, links });
  };

  const addLink = () => {
    onChange({
      ...header,
      links: [...header.links, { label: "", url: "" }],
    });
  };

  const removeLink = (index: number) => {
    onChange({
      ...header,
      links: header.links.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-ink mb-4">Personal Information</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Field
          label="Full Name"
          value={header.fullName}
          onChange={(v) => onChange({ ...header, fullName: v })}
          placeholder="Jane Doe"
        />
        <Field
          label="Professional Headline"
          value={header.headline}
          onChange={(v) => onChange({ ...header, headline: v })}
          placeholder="Senior Software Engineer"
        />
        <Field
          label="Email"
          type="email"
          value={header.email}
          onChange={(v) => onChange({ ...header, email: v })}
          placeholder="jane@example.com"
        />
        <Field
          label="Phone"
          value={header.phone}
          onChange={(v) => onChange({ ...header, phone: v })}
          placeholder="(555) 123-4567"
        />
        <Field
          label="Location"
          value={header.location}
          onChange={(v) => onChange({ ...header, location: v })}
          placeholder="San Francisco, CA"
        />
      </div>

      {/* Links */}
      <div className="mt-6 pt-6 border-t border-black/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-ink">Links</h3>
          <button
            onClick={addLink}
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium"
          >
            <Plus size={14} />
            Add link
          </button>
        </div>

        <div className="space-y-3">
          {header.links.map((link, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={link.label}
                onChange={(e) => updateLink(idx, "label", e.target.value)}
                placeholder="GitHub"
                className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
              />
              <input
                type="url"
                value={link.url}
                onChange={(e) => updateLink(idx, "url", e.target.value)}
                placeholder="https://github.com/username"
                className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
              />
              <button
                onClick={() => removeLink(idx)}
                className="text-black/40 hover:text-black/60 p-2 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-black/40 mb-1.5 block">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-black/10 rounded-lg px-3 py-2.5 text-sm bg-[#fcfcfb] focus:border-accent transition-colors"
      />
    </label>
  );
}
