import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ExperimentStudio } from './components/ExperimentStudio';
import { PresetManager } from './components/PresetManager';
import { RunsMonitor } from './components/RunsMonitor';
import { fetchHealth } from './api/client';
import type { Preset } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<'studio' | 'presets' | 'runs'>('studio');
  const [selectedPresetForStudio, setSelectedPresetForStudio] = useState<Preset | null>(null);
  const [monitoredExpId, setMonitoredExpId] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

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
    setCurrentTab('runs');
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
          />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 font-mono">
        XtalOpt Web Workbench & Crystal Visualizer • Powered by XtalOpt v15 Engine (Zero-Database Architecture)
      </footer>
    </div>
  );
}

export default App;
