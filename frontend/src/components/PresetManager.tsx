import React, { useState, useEffect } from 'react';
import { Copy, Trash2, RefreshCw } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Presets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Saved experiment setups, stored as JSON in <code className="font-mono text-slate-700">presets/</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            title="Refresh presets"
            aria-label="Refresh presets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onCreateNew}
            className="h-9 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
          >
            New preset
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Grid of Preset Cards */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-600 text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading presets…
        </div>
      ) : presets.length === 0 ? (
        <div className="text-center px-6 py-14 bg-white border border-dashed border-slate-300 rounded-lg">
          <h3 className="text-sm font-medium text-slate-900">No presets yet</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Create your first preset in the Experiment Studio or save a configuration.
          </p>
          <button
            onClick={onCreateNew}
            className="h-9 px-4 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Open Experiment Studio
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Composition</th>
                <th className="px-4 py-2.5 font-medium text-right">Atoms</th>
                <th className="px-4 py-2.5 font-medium text-right">Seeds</th>
                <th className="px-4 py-2.5 font-medium text-right">Pool</th>
                <th className="px-4 py-2.5 font-medium text-right">Max structures</th>
                <th className="px-4 py-2.5 font-medium">Optimizer</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {presets.map((preset) => (
                <tr key={preset.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-slate-900">{preset.name}</div>
                    <div className="mt-0.5 max-w-sm text-xs text-slate-500 line-clamp-1">
                      {preset.description || <span className="font-mono">{preset.id}.json</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-slate-700 whitespace-nowrap">{preset.chemicalFormulas}</td>
                  <td className="px-4 py-3 align-top text-right tabular-nums text-slate-700 whitespace-nowrap">{preset.minAtoms}–{preset.maxAtoms}</td>
                  <td className="px-4 py-3 align-top text-right tabular-nums text-slate-700">{preset.numInitial}</td>
                  <td className="px-4 py-3 align-top text-right tabular-nums text-slate-700">{preset.popSize}</td>
                  <td className="px-4 py-3 align-top text-right tabular-nums text-slate-700">{preset.maxNumStructures}</td>
                  <td className="px-4 py-3 align-top text-xs uppercase text-slate-500">{preset.optimizer}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleClone(preset.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        title="Duplicate preset"
                        aria-label={`Duplicate ${preset.name}`}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(preset.id, preset.name)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-red-700 hover:bg-red-50"
                        title="Delete preset"
                        aria-label={`Delete ${preset.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onLoadPreset(preset)}
                        className="ml-1 h-8 px-3 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                      >
                        Open in Studio
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
