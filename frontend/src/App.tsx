import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ExperimentStudio } from './components/ExperimentStudio';
import { PresetManager } from './components/PresetManager';
import { RunsMonitor } from './components/RunsMonitor';
import { CrystalBatteryAnalyzer } from './components/CrystalBatteryAnalyzer';
import { fetchHealth, fetchExperiments, fetchExperimentStructures } from './api/client';
import type { Preset, ExperimentItem } from './types';
import { Sparkles, Layers } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<'studio' | 'presets' | 'runs' | 'analyzer'>('studio');
  const [selectedPresetForStudio, setSelectedPresetForStudio] = useState<Preset | null>(null);
  const [monitoredExpId, setMonitoredExpId] = useState<string | null>(null);
  const [analyzerTarget, setAnalyzerTarget] = useState<{ expId: string; structId: string } | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // Selector state for Analyzer tab when opened directly
  const [availableExperiments, setAvailableExperiments] = useState<ExperimentItem[]>([]);
  const [selectedAnalyzerExpId, setSelectedAnalyzerExpId] = useState<string>('');
  const [availableCandidates, setAvailableCandidates] = useState<string[]>([]);
  const [selectedCandidateTag, setSelectedCandidateTag] = useState<string>('');

  // Check health periodically
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await fetchHealth();
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  // When switching to analyzer or on startup, load available experiments
  useEffect(() => {
    const loadRuns = async () => {
      try {
        const exps = await fetchExperiments();
        setAvailableExperiments(exps);
        if (exps.length > 0 && !selectedAnalyzerExpId) {
          const defaultExp = monitoredExpId || exps[0].exp_id;
          setSelectedAnalyzerExpId(defaultExp);
        }
      } catch (err) {
        console.error('Failed to load runs for analyzer', err);
      }
    };
    loadRuns();
  }, [monitoredExpId, currentTab]);

  // When analyzer experiment changes, fetch its structures
  useEffect(() => {
    if (!selectedAnalyzerExpId) return;
    const loadStructs = async () => {
      try {
        const summary = await fetchExperimentStructures(selectedAnalyzerExpId);
        const tags = summary.structures.map((s) => s.tag);
        setAvailableCandidates(tags);
        if (tags.length > 0) {
          setSelectedCandidateTag(tags[0]);
          setAnalyzerTarget({ expId: selectedAnalyzerExpId, structId: tags[0] });
        }
      } catch (err) {
        console.error('Failed to load structures for candidate', err);
        setAvailableCandidates([]);
      }
    };
    loadStructs();
  }, [selectedAnalyzerExpId]);

  const handleLoadPreset = (preset: Preset) => {
    setSelectedPresetForStudio(preset);
    setCurrentTab('studio');
  };

  const handleCreateNewPreset = () => {
    setSelectedPresetForStudio(null);
    setCurrentTab('studio');
  };

  const handleExperimentLaunched = (expId: string) => {
    setMonitoredExpId(expId);
    setSelectedAnalyzerExpId(expId);
    setCurrentTab('runs');
  };

  const handleOpenAnalyzer = (expId: string, structId: string) => {
    setAnalyzerTarget({ expId, structId });
    setSelectedAnalyzerExpId(expId);
    setSelectedCandidateTag(structId);
    setCurrentTab('analyzer');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-900/50">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        backendOnline={backendOnline}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'studio' && (
          <ExperimentStudio
            initialPreset={selectedPresetForStudio}
            onPresetSaved={() => {}}
            onExperimentLaunched={handleExperimentLaunched}
          />
        )}

        {currentTab === 'presets' && (
          <PresetManager
            onLoadPreset={handleLoadPreset}
            onCreateNew={handleCreateNewPreset}
          />
        )}

        {currentTab === 'runs' && (
          <RunsMonitor
            selectedExpId={monitoredExpId}
            onOpenStudio={() => setCurrentTab('studio')}
            onOpenAnalyzer={handleOpenAnalyzer}
          />
        )}

        {currentTab === 'analyzer' && (
          <div className="space-y-6">
            {/* Quick Candidate Switcher Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-white text-sm">Structure Inspector Selection:</span>
              </div>

              <div className="flex items-center gap-4 flex-wrap text-xs">
                {/* Select Run */}
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
                  <span className="text-slate-400">Run:</span>
                  <select
                    value={selectedAnalyzerExpId}
                    onChange={(e) => setSelectedAnalyzerExpId(e.target.value)}
                    className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
                  >
                    {availableExperiments.map((e) => (
                      <option key={e.exp_id} value={e.exp_id} className="bg-slate-900 text-slate-200">
                        {e.name} ({e.exp_id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Candidate Tag */}
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
                  <span className="text-slate-400">Candidate:</span>
                  <select
                    value={selectedCandidateTag}
                    onChange={(e) => {
                      setSelectedCandidateTag(e.target.value);
                      setAnalyzerTarget({ expId: selectedAnalyzerExpId, structId: e.target.value });
                    }}
                    className="bg-transparent text-emerald-400 font-mono font-medium focus:outline-none cursor-pointer"
                  >
                    {availableCandidates.length === 0 ? (
                      <option value="">No candidates on disk</option>
                    ) : (
                      availableCandidates.map((tag) => (
                        <option key={tag} value={tag} className="bg-slate-900 text-slate-200">
                          {tag}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Render 3D Visualizer, Powder XRD & Cathode Metrics */}
            {analyzerTarget && analyzerTarget.expId && analyzerTarget.structId ? (
              <CrystalBatteryAnalyzer
                expId={analyzerTarget.expId}
                structId={analyzerTarget.structId}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                <Layers className="w-12 h-12 text-slate-600 animate-pulse" />
                <h3 className="text-lg font-semibold text-slate-300">No Candidate Selected</h3>
                <p className="text-xs text-slate-500 max-w-md">
                  Select an experiment and candidate from the selector above or click 'Analyze' on any candidate row in the Runs & Monitor tab.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 font-mono">
        XtalOpt Web Workbench & Crystal Visualizer • Powered by XtalOpt v15 Engine (Zero-Database Architecture)
      </footer>
    </div>
  );
}

export default App;
