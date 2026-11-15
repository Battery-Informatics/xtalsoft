import React, { useState, useEffect } from 'react';
import { Activity, Square, Terminal, RefreshCw } from 'lucide-react';
import { fetchExperiments, stopExperiment, fetchRunStatus, fetchRunLogs } from '../api/client';
import type { ExperimentItem } from '../types';

interface MonitorProps {
  selectedExpId?: string | null;
  onSelectExperiment?: (id: string) => void;
  onOpenStudio?: () => void;
}

export const RunsMonitor: React.FC<MonitorProps> = ({
  selectedExpId: initialSelectedId,
  onOpenStudio,
}) => {
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || null);
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState<any>(null);
  const [logs, setLogs] = useState<{ stdout: string[]; stderr: string[] }>({ stdout: [], stderr: [] });
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load experiments
  const loadExperiments = async () => {
    try {
      const data = await fetchExperiments();
      setExperiments(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].exp_id);
      }
    } catch (e) {
      console.error('Failed to load experiments', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExperiments();
  }, []);

  // Poll status & logs when selectedId changes
  const updateRunDetails = async (id: string) => {
    setLogsLoading(true);
    try {
      const [st, lg] = await Promise.all([
        fetchRunStatus(id).catch(() => null),
        fetchRunLogs(id, 250).catch(() => ({ stdout_lines: [], stderr_lines: [] })),
      ]);
      setLiveStatus(st);
      setLogs({ stdout: lg.stdout_lines || [], stderr: lg.stderr_lines || [] });
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    updateRunDetails(selectedId);

    if (!autoRefresh) return;
    const interval = setInterval(() => {
      updateRunDetails(selectedId);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedId, autoRefresh]);

  const handleStop = async (id: string) => {
    try {
      await stopExperiment(id);
      updateRunDetails(id);
      loadExperiments();
    } catch (e: any) {
      alert(`Error stopping experiment: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
              Run Monitor & Execution (Part 2 Placeholder)
            </span>
            <span className="text-xs text-slate-400">Disk Store: <code className="text-cyan-400 font-mono">runs/*/meta.json</code></span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Active & Historical Runs</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track execution lifecycle, inspect PIDs, and stream stdout/stderr logs from isolated workspaces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
            />
            Auto-refresh (3s)
          </label>

          <button
            onClick={() => {
              loadExperiments();
              if (selectedId) updateRunDetails(selectedId);
            }}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
            title="Refresh Runs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          Loading experiment records...
        </div>
      ) : experiments.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No Experiment Workspaces Found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Launch or stage an experiment from the Experiment Studio to begin tracking.
          </p>
          {onOpenStudio && (
            <button
              onClick={onOpenStudio}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              Open Experiment Studio
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Experiment List (4 cols) */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Discovered Workspaces ({experiments.length})
            </div>
            <div className="divide-y divide-slate-800/80 max-h-[600px] overflow-y-auto">
              {experiments.map((exp) => {
                const isSelected = exp.exp_id === selectedId;
                const isRunning = exp.status === 'running';

                return (
                  <button
                    key={exp.exp_id}
                    onClick={() => setSelectedId(exp.exp_id)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-blue-950/40 border-l-4 border-blue-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-200 truncate">
                        {exp.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${
                          isRunning
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : exp.status === 'stopped'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : exp.status === 'completed'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {exp.status}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-cyan-400 truncate">
                      {exp.chemicalFormulas || 'Custom Composition'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>runs/{exp.exp_id}</span>
                      {exp.pid && <span>PID: {exp.pid}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Live Monitor & Logs (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedId && (
              <>
                {/* Active Experiment Banner */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-slate-400">runs/{selectedId}/meta.json</div>
                    <h2 className="text-lg font-bold text-white mt-0.5">
                      {experiments.find((e) => e.exp_id === selectedId)?.name || selectedId}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
                      <span>Status: <strong className="text-slate-200">{liveStatus?.status || 'idle'}</strong></span>
                      {liveStatus?.pid && <span>PID: <strong className="text-slate-200">{liveStatus.pid}</strong></span>}
                      {liveStatus?.elapsed_seconds !== null && liveStatus?.elapsed_seconds !== undefined && (
                        <span>Elapsed: {Math.round(liveStatus.elapsed_seconds)}s</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {liveStatus?.status === 'running' && (
                      <button
                        onClick={() => handleStop(selectedId)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 transition-all cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-rose-300" />
                        Stop Subprocess
                      </button>
                    )}
                  </div>
                </div>

                {/* Console Log Terminal */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                  <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-300 font-mono">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <span>Console Stream (stdout.log & stderr.log)</span>
                    </div>
                    {logsLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
                  </div>

                  <div className="p-4 font-mono text-xs text-slate-300 max-h-[450px] overflow-y-auto space-y-1">
                    {logs.stdout.length === 0 && logs.stderr.length === 0 ? (
                      <div className="text-slate-600 italic py-8 text-center">
                        No console logs captured yet for runs/{selectedId}/...
                      </div>
                    ) : (
                      <>
                        {logs.stdout.map((line, idx) => (
                          <div key={`out-${idx}`} className="text-slate-300 leading-relaxed">
                            {line}
                          </div>
                        ))}
                        {logs.stderr.map((line, idx) => (
                          <div key={`err-${idx}`} className="text-rose-400 font-semibold leading-relaxed">
                            [STDERR] {line}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
