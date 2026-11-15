import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Sparkles,
  Download,
  FileCode,
  Copy,
  Check,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { fetchStructureAnalysis } from '../api/client';
import type { StructureAnalysisResult } from '../types';
import { CrystalViewer3D } from './CrystalViewer3D';
import { XRDChart } from './XRDChart';
import { StructuralCathodeMetrics } from './StructuralCathodeMetrics';

interface CrystalBatteryAnalyzerProps {
  expId: string;
  structId: string;
  onClose?: () => void;
}

export const CrystalBatteryAnalyzer: React.FC<CrystalBatteryAnalyzerProps> = ({
  expId,
  structId,
  onClose,
}) => {
  const [analysis, setAnalysis] = useState<StructureAnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'rawFiles'>('visualizer');
  const [copiedType, setCopiedType] = useState<'cif' | 'poscar' | null>(null);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStructureAnalysis(expId, structId);
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || 'Failed to compute crystallography analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
  }, [expId, structId]);

  const handleCopy = (text: string, type: 'cif' | 'poscar') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Top Banner Header */}
      <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-700/80 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Experiment:</span>
              <span className="text-xs font-mono text-slate-300 font-semibold">{expId}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs text-slate-400">Candidate:</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{structId}</span>
              {analysis && (
                <span className="text-xs font-mono bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/80">
                  {analysis.formula}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-white tracking-tight mt-0.5">
              Interactive 3D Crystal & Battery Analyzer (Part 4)
            </h2>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* View Tab Toggle */}
          <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('visualizer')}
              className={`px-3 py-1 rounded transition-all ${
                activeTab === 'visualizer'
                  ? 'bg-slate-800 text-emerald-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Visualizer & XRD
            </button>
            <button
              onClick={() => setActiveTab('rawFiles')}
              className={`px-3 py-1 rounded transition-all ${
                activeTab === 'rawFiles'
                  ? 'bg-slate-800 text-cyan-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CIF / POSCAR Text
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={loadAnalysis}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors disabled:opacity-50"
            title="Recompute analysis"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Close analyzer view"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-6">
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-medium">Computing crystallography, XRD, and battery capacity...</p>
            <span className="text-xs text-slate-600">Calculating symmetry, atomic coordination & diffraction</span>
          </div>
        )}

        {error && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-red-400">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={loadAnalysis}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && analysis && (
          <>
            {activeTab === 'visualizer' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 7 Cols: 3D Visualizer & XRD Spectrum */}
                <div className="lg:col-span-7 space-y-6">
                  {/* 3D WebGL Viewer */}
                  <CrystalViewer3D analysis={analysis} />

                  {/* Simulated XRD Chart */}
                  <XRDChart
                    xrdPeaks={analysis.xrd_peaks}
                    formula={analysis.formula}
                    tag={analysis.tag}
                  />
                </div>

                {/* Right 5 Cols: Electrochemical & Crystallographic Metrics */}
                <div className="lg:col-span-5">
                  <StructuralCathodeMetrics analysis={analysis} />
                </div>
              </div>
            ) : (
              /* Raw Text Files View: Standardized CIF & POSCAR */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Standardized CIF */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-slate-200 font-mono">
                        Standardized Conventional .cif
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(analysis.cif_standardized, 'cif')}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800"
                    >
                      {copiedType === 'cif' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-300 overflow-y-auto max-h-[500px] bg-slate-950/70 whitespace-pre">
                    {analysis.cif_standardized}
                  </pre>
                </div>

                {/* VASP POSCAR */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-slate-200 font-mono">
                        VASP 5.x POSCAR Deck
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(analysis.poscar, 'poscar')}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800"
                    >
                      {copiedType === 'poscar' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-300 overflow-y-auto max-h-[500px] bg-slate-950/70 whitespace-pre">
                    {analysis.poscar}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
