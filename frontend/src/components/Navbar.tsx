import React from 'react';
import { Layers, Bookmark, Activity, Cpu, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentTab: 'studio' | 'presets' | 'runs' | 'analyzer';
  setCurrentTab: (tab: 'studio' | 'presets' | 'runs' | 'analyzer') => void;
  backendOnline: boolean | null;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, backendOnline }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-2 rounded-lg text-white shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                XtalOpt Workbench
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                v15 Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">Battery Materials EA Crystal Visualizer</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setCurrentTab('studio')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'studio'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Experiment Studio
          </button>
          <button
            onClick={() => setCurrentTab('presets')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'presets'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Saved Presets
          </button>
          <button
            onClick={() => setCurrentTab('runs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'runs'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            Runs & Monitor
          </button>
          <button
            onClick={() => setCurrentTab('analyzer')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'analyzer'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Crystal & Battery Analyzer
          </button>
        </nav>

        {/* Backend Status indicator */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              backendOnline === true
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : backendOnline === false
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-slate-400">
            {backendOnline === true ? 'Backend Connected' : backendOnline === false ? 'Backend Offline' : 'Connecting...'}
          </span>
        </div>
      </div>
    </header>
  );
};
