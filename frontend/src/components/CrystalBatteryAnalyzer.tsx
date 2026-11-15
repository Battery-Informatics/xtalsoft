import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Copy, Check, AlertCircle } from 'lucide-react';
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
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
      <div className="bg-white px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-900">
              Candidate <span className="font-mono">{structId}</span>
            </h2>
            {analysis && <span className="text-sm font-mono text-slate-600">{analysis.formula}</span>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 truncate">
            Run <span className="font-mono">{expId}</span>
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* View Tab Toggle */}
          <div className="flex rounded-md bg-slate-100 p-0.5 text-xs">
            <button
              onClick={() => setActiveTab('visualizer')}
              className={`px-3 py-1 rounded transition-all ${
                activeTab === 'visualizer'
                  ? 'bg-white text-slate-900 font-medium shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Structure & XRD
            </button>
            <button
              onClick={() => setActiveTab('rawFiles')}
              className={`px-3 py-1 rounded transition-all ${
                activeTab === 'rawFiles'
                  ? 'bg-white text-slate-900 font-medium shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              CIF / POSCAR
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={loadAnalysis}
            disabled={loading}
            className="p-1.5 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition-colors disabled:opacity-50"
            title="Recompute analysis"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 hover:text-slate-900 transition-colors"
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
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600">
            <RefreshCw className="w-8 h-8 text-slate-900 animate-spin" />
            <p className="text-sm font-medium">Computing crystallography, XRD, and battery capacity...</p>
            <span className="text-xs text-slate-400">Calculating symmetry, atomic coordination & diffraction</span>
          </div>
        )}

        {error && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-red-700">
            <AlertCircle className="w-10 h-10 text-red-700" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={loadAnalysis}
              className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs border border-slate-300"
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
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800 font-mono">
                        Standardized Conventional .cif
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(analysis.cif_standardized, 'cif')}
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-white border border-slate-200"
                    >
                      {copiedType === 'cif' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-slate-900" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-700 overflow-y-auto max-h-[500px] bg-slate-50 whitespace-pre">
                    {analysis.cif_standardized}
                  </pre>
                </div>

                {/* VASP POSCAR */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800 font-mono">
                        VASP 5.x POSCAR Deck
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(analysis.poscar, 'poscar')}
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-white border border-slate-200"
                    >
                      {copiedType === 'poscar' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-slate-900" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-700 overflow-y-auto max-h-[500px] bg-slate-50 whitespace-pre">
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
