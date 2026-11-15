import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface TemplateEditorProps {
  template: string;
  onChange: (value: string) => void;
}

const REQUIRED_PLACEHOLDERS = [
  { tag: '%a%', label: 'Vector a' },
  { tag: '%b%', label: 'Vector b' },
  { tag: '%c%', label: 'Vector c' },
  { tag: '%alphaDeg%', label: 'Alpha angle' },
  { tag: '%betaDeg%', label: 'Beta angle' },
  { tag: '%gammaDeg%', label: 'Gamma angle' },
  { tag: '%coordsFrac%', label: 'Fractional coordinates' },
];

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            GULP Input Deck Template (gin1)
          </label>
          <p className="text-xs text-slate-600">
            Optimizer deck template containing force-field specifications and unit cell directives.
          </p>
        </div>
      </div>

      {/* Placeholder validation pills */}
      <div className="bg-white p-3 rounded-lg border border-slate-200">
        <div className="text-[11px] font-semibold text-slate-600 uppercase mb-2">
          Required XtalOpt Macro Tags
        </div>
        <div className="flex flex-wrap gap-2">
          {REQUIRED_PLACEHOLDERS.map(({ tag, label }) => {
            const isPresent = template.includes(tag);
            return (
              <span
                key={tag}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                  isPresent
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
                title={`${label} (${tag})`}
              >
                {isPresent ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                )}
                {tag}
              </span>
            );
          })}
        </div>
      </div>

      {/* Editor textarea */}
      <div className="relative rounded-lg overflow-hidden border border-slate-200 focus-within:border-blue-500 transition-colors">
        <textarea
          rows={14}
          value={template}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white px-4 py-3 font-mono text-xs text-slate-900 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
          placeholder="opti conj conp&#10;cell&#10;  %a% %b% %c% %alphaDeg% %betaDeg% %gammaDeg%&#10;frac&#10;%coordsFrac%..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};
