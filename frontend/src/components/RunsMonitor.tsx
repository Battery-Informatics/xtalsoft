import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  fetchExperiments,
  stopExperiment,
  fetchExperimentStructures,
  subscribeExperimentTelemetry,
} from '../api/client';
import type {
  ExperimentItem,
  ExperimentTelemetry,
  ParsedStructure,
} from '../types';
import { ConvergencePlot } from './ConvergencePlot';
import { CandidateTable } from './CandidateTable';
import { TerminalLogDrawer } from './TerminalLogDrawer';
import { CrystalBatteryAnalyzer } from './CrystalBatteryAnalyzer';

interface RunsMonitorProps {
  selectedExpId?: string | null;
  onOpenStudio?: () => void;
  onOpenAnalyzer?: (expId: string, structId: string) => void;
}

export const RunsMonitor: React.FC<RunsMonitorProps> = ({
  selectedExpId: initialSelectedId,
  onOpenStudio,
  onOpenAnalyzer,
}) => {
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || null);
  const [loading, setLoading] = useState<boolean>(true);
  const [stopping, setStopping] = useState<boolean>(false);

  // Live telemetry state
  const [telemetry, setTelemetry] = useState<ExperimentTelemetry | null>(null);
  const [structures, setStructures] = useState<ParsedStructure[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<ParsedStructure | null>(null);
  const [structuresLoading, setStructuresLoading] = useState<boolean>(false);
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState<boolean>(false);

  // Load experiments list
  const loadExperiments = useCallback(async () => {
    try {
      const data = await fetchExperiments();
      setExperiments(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].exp_id);
      } else if (selectedId && !data.some((e) => e.exp_id === selectedId) && data.length > 0) {
        setSelectedId(data[0].exp_id);
      }
    } catch (e) {
      console.error('Failed to load experiments', e);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  // Update selectedId if parent passes new initialSelectedId
  useEffect(() => {
    if (initialSelectedId && initialSelectedId !== selectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);

  // Load structures for selected experiment
  const loadStructures = useCallback(async (expId: string) => {
    setStructuresLoading(true);
    try {
      const summary = await fetchExperimentStructures(expId);
      setStructures(summary.structures || []);
      // If a structure was selected, refresh its reference
      setSelectedStructure((prev) => {
        if (!prev) return summary.structures[0] || null;
        const updated = summary.structures.find((s) => s.tag === prev.tag);
        return updated || summary.structures[0] || null;
      });
    } catch (e) {
      console.error('Failed to load structures', e);
      setStructures([]);
    } finally {
      setStructuresLoading(false);
    }
  }, []);

  // Subscribe to live telemetry stream (SSE / WS / Polling fallback)
  const prevOptimizedCount = useRef<number>(0);
  useEffect(() => {
    if (!selectedId) {
      setTelemetry(null);
      setStructures([]);
      setSelectedStructure(null);
      return;
    }

    // Initial load of structures
    loadStructures(selectedId);

    // Subscribe to telemetry
    const unsubscribe = subscribeExperimentTelemetry(
      selectedId,
      (data: ExperimentTelemetry) => {
        setTelemetry(data);

        // If newly optimized structures arrived, reload structures
        const currentOpt = data.population.completed_optimized;
        if (currentOpt !== prevOptimizedCount.current) {
          prevOptimizedCount.current = currentOpt;
          loadStructures(selectedId);
        }
      },
      (err) => {
        console.warn('Telemetry stream notice:', err);
      }
    );

    // Also poll structures every 6 seconds if running
    const pollStructs = setInterval(() => {
      loadStructures(selectedId);
    }, 6000);

    return () => {
      unsubscribe();
      clearInterval(pollStructs);
    };
  }, [selectedId, loadStructures]);

  // Stop active run
  const handleStopRun = async () => {
    if (!selectedId) return;
    if (!confirm(`Are you sure you want to stop active search run ${selectedId}?`)) return;

    setStopping(true);
    try {
      await stopExperiment(selectedId);
      await loadExperiments();
      loadStructures(selectedId);
    } catch (e: any) {
      alert(`Failed to stop run: ${e.message}`);
    } finally {
      setStopping(false);
    }
  };

  const currentExp = experiments.find((e) => e.exp_id === selectedId);
  const isRunning =
    telemetry?.process.status === 'running' || currentExp?.status === 'running';

  const getStatusBadge = (status?: string) => {
    const st = (status || 'unknown').toLowerCase();
    if (st === 'running') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Running
        </span>
      );
    }
    if (st === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          Completed
        </span>
      );
    }
    if (st === 'stopped') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Stopped
        </span>
      );
    }
    if (st === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize">
        {status || 'Idle'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">Run</p>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">
              {currentExp?.name || selectedId || 'No run selected'}
            </h1>
            {selectedId && getStatusBadge(telemetry?.process.status || currentExp?.status)}
            {telemetry?.process.pid && (
              <span className="text-xs font-mono text-slate-500">PID {telemetry.process.pid}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Select run"
            className="h-9 max-w-xs rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800"
          >
            {experiments.length === 0 ? (
              <option value="">No runs found</option>
            ) : (
              experiments.map((exp) => (
                <option key={exp.exp_id} value={exp.exp_id}>
                  {exp.name} ({exp.exp_id})
                </option>
              ))
            )}
          </select>

          <button
            onClick={() => {
              loadExperiments();
              if (selectedId) loadStructures(selectedId);
            }}
            disabled={loading || structuresLoading}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="Refresh runs and structures"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${structuresLoading ? 'animate-spin' : ''}`} />
          </button>

          {isRunning && (
            <button
              onClick={handleStopRun}
              disabled={stopping}
              className="h-9 px-3.5 rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-50 text-sm font-medium disabled:opacity-50"
            >
              {stopping ? 'Stopping…' : 'Stop run'}
            </button>
          )}

          {onOpenStudio && (
            <button
              onClick={onOpenStudio}
              className="h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              New run
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
        <div className="bg-white px-4 py-3.5">
          <div className="text-xs text-slate-500">Structures</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {telemetry?.population.total_generated ?? structures.length}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 truncate">{structures.length} parsed on disk</div>
        </div>
        <div className="bg-white px-4 py-3.5">
          <div className="text-xs text-slate-500">Optimized</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {telemetry?.population.completed_optimized ??
              structures.filter((s) => (s.status || '').toLowerCase().includes('optim')).length}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 truncate">Relaxed candidates</div>
        </div>
        <div className="bg-white px-4 py-3.5">
          <div className="text-xs text-slate-500">Running / queued</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {(telemetry?.population.currently_optimizing ?? 0) + (telemetry?.population.queued ?? 0)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 truncate">{telemetry?.population.currently_optimizing ?? 0} active, {telemetry?.population.queued ?? 0} waiting</div>
        </div>
        <div className="bg-white px-4 py-3.5">
          <div className="text-xs text-slate-500">Duplicates</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {telemetry?.population.duplicate ?? 0}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 truncate">Removed by fingerprint</div>
        </div>
        <div className="bg-white px-4 py-3.5 col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-500">Lowest enthalpy (eV/atom)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {telemetry?.population.best_enthalpy_per_atom !== null &&
            telemetry?.population.best_enthalpy_per_atom !== undefined
              ? telemetry.population.best_enthalpy_per_atom.toFixed(4)
              : '–'}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 truncate">{telemetry?.population.best_structure_tag ? <span className="font-mono">{telemetry.population.best_structure_tag}</span> : 'No result yet'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <ConvergencePlot
          structures={structures}
          selectedTag={selectedStructure?.tag}
          onSelectStructure={(struct) => setSelectedStructure(struct)}
        />

        {selectedStructure && (
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-slate-900 text-sm">
                  Candidate <span className="font-mono">{selectedStructure.tag}</span>
                </h4>
                <span className="text-sm font-mono text-slate-600">{selectedStructure.formula}</span>
                <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {selectedStructure.status}
                </span>
              </div>
              <dl className="flex items-center gap-x-5 gap-y-1 text-xs text-slate-500 mt-1.5 flex-wrap">
                <div>
                  Space group{' '}
                  <dd className="inline text-slate-800">
                    {selectedStructure.space_group?.symbol || 'N/A'} (#{selectedStructure.space_group?.number || '?'})
                  </dd>
                </div>
                <div>
                  H/atom{' '}
                  <dd className="inline text-slate-800 font-mono">
                    {selectedStructure.enthalpy_per_atom !== null &&
                    selectedStructure.enthalpy_per_atom !== undefined
                      ? `${selectedStructure.enthalpy_per_atom.toFixed(4)} eV`
                      : 'N/A'}
                  </dd>
                </div>
                <div>
                  Volume{' '}
                  <dd className="inline text-slate-800 font-mono">
                    {selectedStructure.volume ? `${selectedStructure.volume.toFixed(2)} Å³` : 'N/A'}
                  </dd>
                </div>
                {selectedStructure.density && (
                  <div>
                    Density{' '}
                    <dd className="inline text-slate-800 font-mono">{selectedStructure.density.toFixed(2)} g/cm³</dd>
                  </div>
                )}
                {selectedStructure.parents && (
                  <div className="truncate max-w-xs">
                    Parents <dd className="inline text-slate-700 font-mono">{selectedStructure.parents}</dd>
                  </div>
                )}
              </dl>
            </div>

            <button
              onClick={() => {
                if (onOpenAnalyzer && selectedId && selectedStructure) {
                  onOpenAnalyzer(selectedId, selectedStructure.tag);
                }
                setIsAnalyzerOpen(true);
              }}
              className="shrink-0 h-9 px-3.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium cursor-pointer"
              title="Open 3D structure, XRD and cathode metrics"
            >
              Analyze structure
            </button>
          </div>
        )}

        {/* Filterable, Searchable Candidate Table */}
        <CandidateTable
          structures={structures}
          selectedTag={selectedStructure?.tag}
          onSelectStructure={(struct) => setSelectedStructure(struct)}
          onAnalyzeStructure={(struct) => {
            setSelectedStructure(struct);
            if (onOpenAnalyzer && selectedId) {
              onOpenAnalyzer(selectedId, struct.tag);
            }
            setIsAnalyzerOpen(true);
          }}
        />
      </div>

      {/* Interactive 3D Crystal & Battery Analyzer Modal Overlay */}
      {isAnalyzerOpen && selectedStructure && selectedId && (
        <div className="fixed inset-0 z-50 bg-slate-50 p-4 sm:p-6 lg:p-8 overflow-y-auto flex items-start justify-center">
          <div className="max-w-6xl w-full my-6">
            <CrystalBatteryAnalyzer
              expId={selectedId}
              structId={selectedStructure.tag}
              onClose={() => setIsAnalyzerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Collapsible Live Execution Terminal Drawer */}
      <TerminalLogDrawer
        stdoutLines={telemetry?.logs.stdout_lines || []}
        stderrLines={telemetry?.logs.stderr_lines || []}
        isRunning={isRunning}
      />
    </div>
  );
};
