import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Copy, Check, Maximize2, Minimize2, AlertCircle, FileText } from 'lucide-react';

interface TerminalLogDrawerProps {
  stdoutLines: string[];
  stderrLines: string[];
  isRunning?: boolean;
}

export const TerminalLogDrawer: React.FC<TerminalLogDrawerProps> = ({
  stdoutLines,
  stderrLines,
  isRunning = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'stdout' | 'stderr'>('stdout');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new lines arrive
  useEffect(() => {
    if (autoScroll && isOpen && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [stdoutLines, stderrLines, autoScroll, isOpen, activeTab]);

  const currentLines = activeTab === 'stdout' ? stdoutLines : stderrLines;

  const handleCopyLogs = () => {
    const text = currentLines.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const colorizeLine = (line: string, index: number) => {
    const l = line.toLowerCase();
    let textColor = 'text-slate-700';

    if (l.includes('error') || l.includes('failed') || l.includes('fatal') || l.includes('exception')) {
      textColor = 'text-red-700 font-semibold';
    } else if (l.includes('warn') || l.includes('caution')) {
      textColor = 'text-amber-700';
    } else if (l.includes('optimized') || l.includes('success') || l.includes('complete')) {
      textColor = 'text-slate-900 font-medium';
    } else if (l.includes('generation') || l.includes('starting') || l.includes('---')) {
      textColor = 'text-blue-700 font-medium';
    } else if (line.startsWith('#')) {
      textColor = 'text-slate-500 italic';
    }

    return (
      <div key={index} className="flex leading-5 hover:bg-white px-2 py-0.5 rounded font-mono text-xs">
        <span className="w-12 text-slate-400 select-none text-right pr-3 shrink-0">
          {index + 1}
        </span>
        <span className={`${textColor} break-all whitespace-pre-wrap`}>{line}</span>
      </div>
    );
  };

  return (
    <div
      className={`border border-slate-200 bg-slate-50 rounded-lg overflow-hidden transition-all duration-200 flex flex-col ${
        isExpanded ? 'fixed inset-4 z-50' : 'w-full'
      }`}
    >
      {/* Top Header Bar */}
      <div className="bg-white px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-slate-800 hover:text-slate-900 transition-colors"
          >
            <span className="font-semibold text-xs">XtalOpt Live Execution Terminal</span>
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-slate-600" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {isRunning && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 " />
              Process Active
            </span>
          )}
        </div>

        {/* Tab & Action Controls */}
        <div className="flex items-center gap-2">
          {/* Tab Selector */}
          <div className="flex rounded-md bg-slate-50 p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('stdout')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                activeTab === 'stdout'
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3 h-3" />
              stdout
              <span className="text-[10px] bg-white px-1.5 rounded-full text-slate-600 ml-0.5">
                {stdoutLines.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('stderr')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                activeTab === 'stderr'
                  ? 'bg-slate-100 text-amber-700 font-medium'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              stderr
              {stderrLines.length > 0 && (
                <span className="text-[10px] bg-red-50 text-red-700 px-1.5 rounded-full ml-0.5 font-semibold">
                  {stderrLines.length}
                </span>
              )}
            </button>
          </div>

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 border ${
              autoScroll
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-800'
            }`}
            title="Auto-scroll to latest output"
          >
            <RotateCcw className={`w-3 h-3 ${autoScroll ? 'animate-spin' : ''}`} />
            Auto-scroll
          </button>

          {/* Copy logs */}
          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
            title="Copy logs to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Expand / Minimize toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
            title={isExpanded ? 'Minimize drawer' : 'Maximize drawer'}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      {isOpen && (
        <div
          ref={logContainerRef}
          className={`p-3 bg-slate-50 font-mono text-xs overflow-y-auto ${
            isExpanded ? 'flex-1 h-[calc(100vh-140px)]' : 'h-64'
          }`}
        >
          {currentLines.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              No {activeTab} output recorded yet.
            </div>
          ) : (
            <div>
              {currentLines.map((line, idx) => colorizeLine(line, idx))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
