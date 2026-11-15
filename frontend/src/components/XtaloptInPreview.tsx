import React, { useState } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';

interface PreviewProps {
  content: string;
  loading?: boolean;
  onRefresh?: () => void;
}

export const XtaloptInPreview: React.FC<PreviewProps> = ({ content, loading, onRefresh }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface border border-slate-200 rounded-lg overflow-hidden flex flex-col h-full ">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
          <span>xtalopt.in Live Preview</span>
          <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
            Read-only
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Refresh Preview"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-300"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-slate-900" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-auto bg-slate-50">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-500 text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-700" />
            Generating xtalopt.in preview...
          </div>
        ) : (
          <pre className="font-mono text-xs text-slate-700 whitespace-pre leading-relaxed">
            {content || '# Generating preview...'}
          </pre>
        )}
      </div>
    </div>
  );
};
