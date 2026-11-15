import React, { useState } from 'react';
import { Copy, Check, FileCode, RefreshCw } from 'lucide-react';

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
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full shadow-lg">
      <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <FileCode className="w-4 h-4 text-cyan-400" />
          <span>xtalopt.in Live Preview</span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
            Read-only
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Refresh Preview"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-auto bg-slate-950">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-500 text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
            Generating xtalopt.in preview...
          </div>
        ) : (
          <pre className="font-mono text-xs text-slate-300 whitespace-pre leading-relaxed selection:bg-cyan-900/40">
            {content || '# Generating preview...'}
          </pre>
        )}
      </div>
    </div>
  );
};
