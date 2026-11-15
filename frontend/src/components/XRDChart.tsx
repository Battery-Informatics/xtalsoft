import React, { useEffect, useRef, useState } from 'react';
import { X, HelpCircle } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
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
        color: '#a8b1ff',
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
        color: '#a8b1ff',
        symbol: 'circle',
        line: { color: '#5c73e7', width: 1 },
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
          color: '#f66f81',
          width: 2,
        },
        hoverinfo: 'x+y',
      });
    }

    const layout: Partial<Plotly.Layout> = {
      autosize: true,
      paper_bgcolor: 'transparent',
      modebar: { bgcolor: 'rgba(0, 0, 0, 0)', color: '#6a6a71', activecolor: '#dfdfd6' },
      plot_bgcolor: 'rgba(0, 0, 0, 0)',
      font: {
        family: 'ui-sans-serif, system-ui, sans-serif',
        color: '#98989f',
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
        bgcolor: 'rgba(32, 33, 39, 0.9)',
        bordercolor: '#2e2e32',
        borderwidth: 1,
        font: { size: 10, color: '#98989f' },
      },
      xaxis: {
        title: {
          text: 'Diffraction Angle 2θ (deg, Cu Kα)',
          font: { color: '#98989f', size: 12 },
        },
        range: [10, 80],
        gridcolor: '#2e2e32',
        zerolinecolor: '#3c3f44',
        color: '#98989f',
      },
      yaxis: {
        title: {
          text: 'Relative Intensity (%)',
          font: { color: '#98989f', size: 12 },
        },
        range: [-2, 110],
        gridcolor: '#2e2e32',
        zerolinecolor: '#3c3f44',
        color: '#98989f',
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
    <div className="bg-surface border border-slate-200 rounded-lg p-4 flex flex-col ">
      {/* Header & Experimental Overlay Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 text-sm">
              Simulated Powder XRD Pattern (Cu Kα)
            </h3>
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
              λ = 1.54184 Å
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">
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
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-xs text-blue-700">
              <span className="truncate max-w-[150px] font-mono text-[11px]">
                {experimentalData.filename}
              </span>
              <button
                onClick={handleClearExperimental}
                className="text-blue-700 hover:text-slate-900"
                title="Remove experimental pattern"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs border border-slate-300 transition-colors shadow-sm"
              title="Upload experimental .xy or .csv data to overlay"
            >
              Overlay Experimental XRD
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
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
        <span className="text-slate-600 font-mono">2θ: 10° – 80°</span>
      </div>
    </div>
  );
};
