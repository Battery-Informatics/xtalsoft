import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Upload, X, HelpCircle } from 'lucide-react';
import type { XRDPak } from '../types';

interface XRDChartProps {
  xrdPeaks: XRDPak[];
  formula: string;
  tag: string;
}

interface ExperimentalData {
  filename: string;
  x: number[];
  y: number[];
}

export const XRDChart: React.FC<XRDChartProps> = ({ xrdPeaks, formula, tag }) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [experimentalData, setExperimentalData] = useState<ExperimentalData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handle client-side file upload (.xy, .csv, .dat, .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/);
        const xs: number[] = [];
        const ys: number[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('2theta')) {
            continue;
          }

          // Split by comma, tab, or whitespace
          const parts = trimmed.split(/[\s,;\t]+/).map(Number);
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const twoTheta = parts[0];
            const intensity = parts[1];
            if (twoTheta >= 5 && twoTheta <= 90) {
              xs.push(twoTheta);
              ys.push(intensity);
            }
          }
        }

        if (xs.length === 0) {
          setErrorMsg('No valid (2θ, intensity) numeric pairs found in file.');
          return;
        }

        // Normalize experimental intensity to 100%
        const maxY = Math.max(...ys);
        const normY = maxY > 0 ? ys.map((y) => (y / maxY) * 100.0) : ys;

        setExperimentalData({
          filename: file.name,
          x: xs,
          y: normY,
        });
      } catch (err: any) {
        setErrorMsg(`Failed to parse file: ${err.message}`);
      }
    };

    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleClearExperimental = () => {
    setExperimentalData(null);
    setErrorMsg(null);
  };

  // Render Plotly XRD Chart
  useEffect(() => {
    if (!plotRef.current) return;

    if (!xrdPeaks || xrdPeaks.length === 0) {
      Plotly.purge(plotRef.current);
      return;
    }

    const traces: Plotly.Data[] = [];

    // 1. Simulated Stick Reflections (mode: lines/markers)
    // To draw stick peaks: each peak has [x, x, null], [0, y, null]
    const stickX: (number | null)[] = [];
    const stickY: (number | null)[] = [];
    const pointX: number[] = [];
    const pointY: number[] = [];
    const pointText: string[] = [];

    xrdPeaks.forEach((p) => {
      stickX.push(p.two_theta, p.two_theta, null);
      stickY.push(0, p.intensity, null);

      pointX.push(p.two_theta);
      pointY.push(p.intensity);
      pointText.push(
        `<b>${p.hkl}</b><br>` +
        `2θ: <b>${p.two_theta.toFixed(2)}°</b><br>` +
        `Intensity: <b>${p.intensity.toFixed(1)}%</b><br>` +
        `d-spacing: ${p.d_spacing.toFixed(4)} Å`
      );
    });

    // Peak lines trace
    traces.push({
      x: stickX as any,
      y: stickY as any,
      mode: 'lines',
      type: 'scatter',
      name: `Simulated Peaks (${formula})`,
      line: {
        color: '#10b981',
        width: 2,
      },
      hoverinfo: 'skip',
    });

    // Peak tops markers trace with interactive hover
    traces.push({
      x: pointX,
      y: pointY,
      text: pointText,
      hoverinfo: 'text',
      mode: 'markers',
      type: 'scatter',
      name: 'Reflections (hkl)',
      marker: {
        size: 7,
        color: '#34d399',
        symbol: 'circle',
        line: { color: '#064e3b', width: 1 },
      },
    });

    // 2. Experimental Pattern Overlay (if uploaded)
    if (experimentalData) {
      traces.push({
        x: experimentalData.x,
        y: experimentalData.y,
        mode: 'lines',
        type: 'scatter',
        name: `Observed: ${experimentalData.filename}`,
        line: {
          color: '#38bdf8', // sky-400
          width: 2,
        },
        hoverinfo: 'x+y',
      });
    }

    const layout: Partial<Plotly.Layout> = {
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'rgba(15, 23, 42, 0.65)',
      font: {
        family: 'ui-sans-serif, system-ui, sans-serif',
        color: '#94a3b8',
        size: 11,
      },
      margin: { l: 60, r: 25, t: 25, b: 50 },
      hovermode: 'closest',
      dragmode: 'zoom',
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.15,
        bgcolor: 'rgba(30, 41, 59, 0.75)',
        bordercolor: '#334155',
        borderwidth: 1,
        font: { size: 10, color: '#cbd5e1' },
      },
      xaxis: {
        title: {
          text: 'Diffraction Angle 2θ (deg, Cu Kα)',
          font: { color: '#cbd5e1', size: 12 },
        },
        range: [10, 80],
        gridcolor: '#1e293b',
        zerolinecolor: '#334155',
        color: '#94a3b8',
      },
      yaxis: {
        title: {
          text: 'Relative Intensity (%)',
          font: { color: '#cbd5e1', size: 12 },
        },
        range: [-2, 110],
        gridcolor: '#1e293b',
        zerolinecolor: '#334155',
        color: '#94a3b8',
      },
    };

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      displayModeBar: true,
    };

    Plotly.react(plotRef.current, traces, layout, config);

    const handleResize = () => {
      if (plotRef.current) {
        Plotly.Plots.resize(plotRef.current);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [xrdPeaks, formula, experimentalData]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col shadow-2xl">
      {/* Header & Experimental Overlay Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-100 text-sm tracking-wide">
              Simulated Powder XRD Pattern (Cu Kα)
            </h3>
            <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
              λ = 1.54184 Å
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Bragg diffraction reflections for candidate {tag} ({formula})
          </p>
        </div>

        {/* Client-side Experimental Upload Controls */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xy,.csv,.dat,.txt"
            className="hidden"
          />

          {experimentalData ? (
            <div className="flex items-center gap-2 bg-sky-950/80 border border-sky-800/80 px-2.5 py-1 rounded-lg text-xs text-sky-200">
              <span className="truncate max-w-[150px] font-mono text-[11px]">
                {experimentalData.filename}
              </span>
              <button
                onClick={handleClearExperimental}
                className="text-sky-400 hover:text-white"
                title="Remove experimental pattern"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition-colors shadow-sm"
              title="Upload experimental .xy or .csv data to overlay"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              Overlay Experimental XRD
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-2 p-2 bg-red-950/60 border border-red-800 rounded text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Plot Container */}
      <div className="relative w-full h-[320px]">
        {xrdPeaks.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
            No diffraction peaks computed.
          </div>
        ) : (
          <div ref={plotRef} className="w-full h-full" />
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          Hover over peak markers to inspect (hkl) indices and d-spacings
        </span>
        <span className="text-slate-400 font-mono">2θ: 10° – 80°</span>
      </div>
    </div>
  );
};
