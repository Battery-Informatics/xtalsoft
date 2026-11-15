import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ExperimentStudio } from './components/ExperimentStudio';
import { PresetManager } from './components/PresetManager';
import { RunsMonitor } from './components/RunsMonitor';
import { CrystalBatteryAnalyzer } from './components/CrystalBatteryAnalyzer';
import { fetchHealth, fetchExperiments, fetchExperimentStructures } from './api/client';
import type { Preset, ExperimentItem } from './types';

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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
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
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Structure Analysis</h1>
                <p className="mt-1 text-sm text-slate-500">3D structure, simulated powder XRD and cathode metrics for one candidate.</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Run
                  <select
                    value={selectedAnalyzerExpId}
                    onChange={(e) => setSelectedAnalyzerExpId(e.target.value)}
                    className="h-9 min-w-48 rounded-md border border-slate-300 bg-slate-50 px-2.5 text-sm font-normal"
                  >
                    {availableExperiments.length === 0 && <option value="">No runs yet</option>}
                    {availableExperiments.map((e) => (
                      <option key={e.exp_id} value={e.exp_id}>
                        {e.name} ({e.exp_id})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Candidate
                  <select
                    value={selectedCandidateTag}
                    onChange={(e) => {
                      setSelectedCandidateTag(e.target.value);
                      setAnalyzerTarget({ expId: selectedAnalyzerExpId, structId: e.target.value });
                    }}
                    className="h-9 min-w-36 rounded-md border border-slate-300 bg-slate-50 px-2.5 font-mono text-sm font-normal"
                  >
                    {availableCandidates.length === 0 ? (
                      <option value="">None on disk</option>
                    ) : (
                      availableCandidates.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>
            </div>

            {analyzerTarget && analyzerTarget.expId && analyzerTarget.structId ? (
              <CrystalBatteryAnalyzer
                expId={analyzerTarget.expId}
                structId={analyzerTarget.structId}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-surface px-6 py-16 text-center">
                <h3 className="text-sm font-medium text-slate-900">No candidate selected</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Pick a run and candidate above, or choose Analyze on a candidate in Runs.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
          XtalOpt Workbench · runs the XtalOpt v15 CLI
        </div>
      </footer>
    </div>
  );
}

export default App;
