import React, { useState, useEffect } from 'react';
import { Bookmark, Copy, Trash2, ArrowUpRight, Plus, RefreshCw } from 'lucide-react';
import { fetchPresets, deletePreset, clonePreset } from '../api/client';
import type { Preset } from '../types';

interface PresetManagerProps {
  onLoadPreset: (preset: Preset) => void;
  onCreateNew: () => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({ onLoadPreset, onCreateNew }) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPresets();
      setPresets(data);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch presets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete preset "${name}"?`)) return;
    try {
      await deletePreset(id);
      setActionMessage(`Preset "${name}" deleted.`);
      loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to delete preset');
    }
  };

  const handleClone = async (id: string) => {
    try {
      await clonePreset(id);
      setActionMessage('Preset cloned successfully!');
      loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to clone preset');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
              Template Repository
            </span>
            <span className="text-xs text-slate-400">Disk Location: <code className="text-cyan-400 font-mono">presets/*.json</code></span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Saved Experiment Presets</h1>
          <p className="text-sm text-slate-400 mt-1">
            Reusable composition ranges, population limits, and force-field decks stored as clean JSON files.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
            title="Refresh Presets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Preset
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-cyan-950/80 border border-cyan-800 rounded-xl text-xs text-cyan-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-xl text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Grid of Preset Cards */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 text-sm gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
          Loading presets from presets/*.json...
        </div>
      ) : presets.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl">
          <Bookmark className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No Presets Found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Create your first preset in the Experiment Studio or save a configuration.
          </p>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            Open Experiment Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition-all shadow-md group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {preset.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                        {preset.chemicalFormulas}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {preset.optimizer.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700">
                    {preset.id}.json
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {preset.description || 'No description provided.'}
                </p>

                {/* Parameters pill list */}
                <div className="grid grid-cols-4 gap-2 py-2 px-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center font-mono text-[11px]">
                  <div>
                    <div className="text-slate-500 text-[9px] uppercase">Atoms</div>
                    <div className="text-slate-300 font-semibold">{preset.minAtoms}–{preset.maxAtoms}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[9px] uppercase">Seeds</div>
                    <div className="text-slate-300 font-semibold">{preset.numInitial}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[9px] uppercase">Pool</div>
                    <div className="text-slate-300 font-semibold">{preset.popSize}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[9px] uppercase">Max Struct</div>
                    <div className="text-slate-300 font-semibold">{preset.maxNumStructures}</div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleClone(preset.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Clone Preset"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(preset.id, preset.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                    title="Delete Preset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => onLoadPreset(preset)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Load into Studio
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
