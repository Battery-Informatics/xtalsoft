import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  Square,
  RefreshCw,
  PlusCircle,
  Clock,
  Layers,
  Sparkles,
  GitBranch,
  ShieldCheck,
  TrendingDown,
  Box,
  AlertCircle,
  Copy,
} from 'lucide-react';
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

interface RunsMonitorProps {
  selectedExpId?: string | null;
  onOpenStudio?: () => void;
}

export const RunsMonitor: React.FC<RunsMonitorProps> = ({
  selectedExpId: initialSelectedId,
  onOpenStudio,
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
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 shadow-sm animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Running
        </span>
      );
    }
    if (st === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/90 text-blue-300 border border-blue-700/80 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          Completed
        </span>
      );
    }
    if (st === 'stopped') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/90 text-amber-300 border border-amber-700/80 shadow-sm">
          <Square className="w-3.5 h-3.5 text-amber-400" />
          Stopped
        </span>
      );
    }
    if (st === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-950/90 text-red-300 border border-red-700/80 shadow-sm">
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
        {status || 'Idle'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Experiment Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              Part 3 Live Population Monitor
            </span>
            <span className="text-xs text-slate-400">
              Real-time telemetry & convergence analysis
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              {currentExp?.name || selectedId || 'No Experiment Selected'}
            </h1>
            {selectedId && getStatusBadge(telemetry?.process.status || currentExp?.status)}
            {telemetry?.process.pid && (
              <span className="text-xs font-mono bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
                PID: {telemetry.process.pid}
              </span>
            )}
          </div>
        </div>

        {/* Experiment Selector & Control Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Experiment Dropdown */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <span className="text-xs text-slate-400">Run:</span>
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              {experiments.length === 0 ? (
                <option value="">No runs found</option>
              ) : (
                experiments.map((exp) => (
                  <option key={exp.exp_id} value={exp.exp_id} className="bg-slate-900 text-slate-200">
                    {exp.name} ({exp.exp_id})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              loadExperiments();
              if (selectedId) loadStructures(selectedId);
            }}
            disabled={loading || structuresLoading}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh runs and structures"
          >
            <RefreshCw className={`w-4 h-4 ${structuresLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Stop Button */}
          {isRunning && (
            <button
              onClick={handleStopRun}
              disabled={stopping}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              {stopping ? 'Stopping...' : 'Stop Search'}
            </button>
          )}

          {/* New Run Button */}
          {onOpenStudio && (
            <button
              onClick={onOpenStudio}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-lg shadow-emerald-950/50"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Run
            </button>
          )}
        </div>
      </div>

      {/* Telemetry Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Structures */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Structures</span>
            <Box className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {telemetry?.population.total_generated ?? structures.length}
            </span>
            <span className="text-[11px] text-slate-500">candidates</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            {structures.length} parsed on disk
          </div>
        </div>

        {/* Completed / Optimized */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Optimized</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {telemetry?.population.completed_optimized ??
                structures.filter((s) => (s.status || '').toLowerCase().includes('optim')).length}
            </span>
            <span className="text-[11px] text-emerald-500/80 font-medium">relaxed</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            Valid candidate pool
          </div>
        </div>

        {/* Running / Queued */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Running / Queued</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-sky-400">
              {(telemetry?.population.currently_optimizing ?? 0) + (telemetry?.population.queued ?? 0)}
            </span>
            <span className="text-[11px] text-sky-500/80 font-medium">in queue</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            {telemetry?.population.currently_optimizing ?? 0} active, {telemetry?.population.queued ?? 0} waiting
          </div>
        </div>

        {/* Duplicates / Similar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Duplicates</span>
            <Copy className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-purple-400">
              {telemetry?.population.duplicate ?? 0}
            </span>
            <span className="text-[11px] text-purple-500/80 font-medium">pruned</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            Fingerprint matches
          </div>
        </div>

        {/* Best Enthalpy / Atom */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Lowest Enthalpy</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-300">
              {telemetry?.population.best_enthalpy_per_atom !== null &&
              telemetry?.population.best_enthalpy_per_atom !== undefined
                ? `${telemetry.population.best_enthalpy_per_atom.toFixed(4)}`
                : '-'}
            </span>
            <span className="text-[10px] text-slate-400">eV/at</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate flex items-center gap-1 font-mono">
            {telemetry?.population.best_structure_tag ? (
              <span className="text-emerald-400 font-semibold">
                Tag: {telemetry.population.best_structure_tag}
              </span>
            ) : (
              'Searching...'
            )}
          </div>
        </div>
      </div>

      {/* Main Visualizer & Landscape Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Interactive Plotly Convergence Plot */}
        <ConvergencePlot
          structures={structures}
          selectedTag={selectedStructure?.tag}
          onSelectStructure={(struct) => setSelectedStructure(struct)}
        />

        {/* Selected Candidate Inspector Banner */}
        {selectedStructure && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm font-mono">
                    Candidate: {selectedStructure.tag}
                  </h4>
                  <span className="text-xs font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    {selectedStructure.formula}
                  </span>
                  <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    {selectedStructure.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    SG:{' '}
                    <b className="text-slate-200">
                      {selectedStructure.space_group?.symbol || 'N/A'} (
                      #{selectedStructure.space_group?.number || '?'})
                    </b>
                  </span>
                  <span>
                    H/atom:{' '}
                    <b className="text-emerald-300 font-mono">
                      {selectedStructure.enthalpy_per_atom !== null &&
                      selectedStructure.enthalpy_per_atom !== undefined
                        ? `${selectedStructure.enthalpy_per_atom.toFixed(4)} eV`
                        : 'N/A'}
                    </b>
                  </span>
                  <span>
                    Volume:{' '}
                    <b className="text-slate-200 font-mono">
                      {selectedStructure.volume ? `${selectedStructure.volume.toFixed(2)} Å³` : 'N/A'}
                    </b>
                  </span>
                  {selectedStructure.density && (
                    <span>
                      Density:{' '}
                      <b className="text-slate-200 font-mono">
                        {selectedStructure.density.toFixed(2)} g/cm³
                      </b>
                    </span>
                  )}
                  {selectedStructure.parents && (
                    <span className="flex items-center gap-1 text-slate-400 truncate max-w-xs font-mono text-[11px]">
                      <GitBranch className="w-3 h-3 text-slate-500" />
                      {selectedStructure.parents}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md border border-slate-700">
                Ready for 3D Visualizer & XRD (Part 4)
              </span>
            </div>
          </div>
        )}

        {/* Filterable, Searchable Candidate Table */}
        <CandidateTable
          structures={structures}
          selectedTag={selectedStructure?.tag}
          onSelectStructure={(struct) => setSelectedStructure(struct)}
        />
      </div>

      {/* Collapsible Live Execution Terminal Drawer */}
      <TerminalLogDrawer
        stdoutLines={telemetry?.logs.stdout_lines || []}
        stderrLines={telemetry?.logs.stderr_lines || []}
        isRunning={isRunning}
      />
    </div>
  );
};
