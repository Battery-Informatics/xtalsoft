import React, { useEffect, useRef, useState } from 'react';
import { Activity, Layers, Filter } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import type { ParsedStructure } from '../types';

interface ConvergencePlotProps {
  structures: ParsedStructure[];
  selectedTag?: string | null;
  onSelectStructure: (structure: ParsedStructure) => void;
}

export const ConvergencePlot: React.FC<ConvergencePlotProps> = ({
  structures,
  selectedTag,
  onSelectStructure,
}) => {
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const [colorBy, setColorBy] = useState<'status' | 'spaceGroup'>('status');

  useEffect(() => {
    if (!plotContainerRef.current) return;

    if (!structures || structures.length === 0) {
      Plotly.purge(plotContainerRef.current);
      return;
    }

    // Sort valid structures by index
    const validStructures = structures
      .filter((s) => s.enthalpy_per_atom !== null && s.enthalpy_per_atom !== undefined)
      .sort((a, b) => a.index - b.index);

    if (validStructures.length === 0) {
      Plotly.purge(plotContainerRef.current);
      return;
    }

    // 1. Group structures by color category
    const groups: { [key: string]: ParsedStructure[] } = {};

    validStructures.forEach((s) => {
      let key = 'Other';
      if (colorBy === 'status') {
        const st = (s.status || '').toLowerCase();
        if (st.includes('optim')) key = 'Optimized';
        else if (st.includes('process') || st.includes('updating')) key = 'In Process';
        else if (st.includes('wait') || st.includes('submit')) key = 'Queued';
        else if (st.includes('sim') || st.includes('duplicate')) key = 'Duplicate';
        else if (st.includes('fail') || st.includes('error')) key = 'Failed';
        else key = s.status || 'Other';
      } else {
        key = s.space_group?.symbol ? `${s.space_group.symbol} (#${s.space_group.number})` : 'Unassigned';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    // Define color mappings for known statuses
    const statusColors: Record<string, string> = {
      Optimized: '#3dd68c',
      'In Process': '#5c73e7',
      Queued: '#f9b44e',
      Duplicate: '#c8abfa',
      Failed: '#f66f81',
      Other: '#6a6a71',
    };

    const traces: Plotly.Data[] = [];

    // 2. Add scatter traces for each group
    Object.keys(groups).forEach((groupName, i) => {
      const groupItems = groups[groupName];
      const markerColor =
        colorBy === 'status'
          ? statusColors[groupName] || '#6a6a71'
          : `hsl(${(i * 137.5) % 360}, 70%, 55%)`;

      traces.push({
        x: groupItems.map((s) => s.index),
        y: groupItems.map((s) => s.enthalpy_per_atom as number),
        customdata: groupItems.map((s) => s.tag),
        text: groupItems.map(
          (s) =>
            `<b>${s.tag}</b> (${s.formula})<br>` +
            `Index: ${s.index} | Gen: ${s.generation}<br>` +
            `H/atom: <b>${s.enthalpy_per_atom?.toFixed(4)} eV/atom</b><br>` +
            `SG: ${s.space_group?.symbol || 'N/A'} (#${s.space_group?.number || '?'})<br>` +
            `Status: ${s.status}<br>` +
            `Lineage: ${s.parents || 'initial generation'}`
        ),
        hoverinfo: 'text',
        mode: 'markers',
        type: 'scatter',
        name: groupName,
        marker: {
          size: groupItems.map((s) => (s.tag === selectedTag ? 14 : 9)),
          color: markerColor,
          line: {
            color: groupItems.map((s) => (s.tag === selectedTag ? '#dfdfd6' : '#1b1b1f')),
            width: groupItems.map((s) => (s.tag === selectedTag ? 3 : 1)),
          },
          opacity: 0.88,
        },
      });
    });

    // 3. Compute running lowest-energy envelope trace (for optimized candidates)
    const optimizedCandidates = validStructures.filter((s) =>
      (s.status || '').toLowerCase().includes('optim')
    );

    if (optimizedCandidates.length > 0) {
      let currentMin = Infinity;
      const envX: number[] = [];
      const envY: number[] = [];
      const envTags: string[] = [];

      optimizedCandidates.forEach((s) => {
        const val = s.enthalpy_per_atom as number;
        if (val < currentMin) {
          currentMin = val;
        }
        envX.push(s.index);
        envY.push(currentMin);
        envTags.push(s.tag);
      });

      traces.push({
        x: envX,
        y: envY,
        mode: 'lines',
        type: 'scatter',
        name: 'Lowest Energy Envelope',
        line: {
          color: '#a8b1ff',
          width: 2.5,
          shape: 'hv', // Stepped horizontal-vertical envelope line
        },
        hoverinfo: 'skip',
      });
    }

    // 4. Highlight Selected Marker if any
    if (selectedTag) {
      const sel = validStructures.find((s) => s.tag === selectedTag);
      if (sel && sel.enthalpy_per_atom !== null && sel.enthalpy_per_atom !== undefined) {
        traces.push({
          x: [sel.index],
          y: [sel.enthalpy_per_atom as number],
          mode: 'markers',
          type: 'scatter',
          name: `Selected: ${selectedTag}`,
          showlegend: false,
          hoverinfo: 'skip',
          marker: {
            size: 18,
            symbol: 'circle-open',
            color: '#f9b44e',
            line: {
              color: '#f9b44e',
              width: 3,
            },
          },
        });
      }
    }

    // 5. Layout Configuration
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
      margin: { l: 65, r: 25, t: 30, b: 50 },
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
          text: 'Structure Index',
          font: { color: '#98989f', size: 12 },
        },
        gridcolor: '#2e2e32',
        zerolinecolor: '#3c3f44',
        color: '#98989f',
      },
      yaxis: {
        title: {
          text: 'Enthalpy per Atom (eV/atom)',
          font: { color: '#98989f', size: 12 },
        },
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

    Plotly.react(plotContainerRef.current, traces, layout, config).then(() => {
      const container = plotContainerRef.current as any;
      if (container && container.on) {
        container.removeAllListeners && container.removeAllListeners('plotly_click');
        container.on('plotly_click', (data: any) => {
          if (data && data.points && data.points[0]) {
            const point = data.points[0];
            const clickedTag = point.customdata;
            if (clickedTag) {
              const matched = structures.find((s) => s.tag === clickedTag);
              if (matched) {
                onSelectStructure(matched);
              }
            }
          }
        });
      }
    });

    const handleResize = () => {
      if (plotContainerRef.current) {
        Plotly.Plots.resize(plotContainerRef.current);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [structures, selectedTag, colorBy, onSelectStructure]);

  return (
    <div className="bg-surface border border-slate-200 rounded-lg p-4 flex flex-col ">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900 text-sm">
            Energy convergence
          </h3>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-300">
            {structures.length} candidates
          </span>
        </div>

        {/* Color By Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-600 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Color by:
          </span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-300">
            <button
              onClick={() => setColorBy('status')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                colorBy === 'status'
                  ? 'bg-slate-300 text-slate-900 font-medium'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Status
            </button>
            <button
              onClick={() => setColorBy('spaceGroup')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                colorBy === 'spaceGroup'
                  ? 'bg-slate-300 text-slate-900 font-medium'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3 h-3" />
              Space Group
            </button>
          </div>
        </div>
      </div>

      {/* Plot Container */}
      <div className="relative w-full h-[360px]">
        {structures.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <Activity className="w-8 h-8 opacity-40 " />
            <p className="text-sm">No structure energy data available yet</p>
            <span className="text-xs text-slate-400">
              Structures will appear here as XtalOpt generates and optimizes candidates
            </span>
          </div>
        ) : (
          <div ref={plotContainerRef} className="w-full h-full" />
        )}
      </div>

      {/* Footer hint */}
      <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Click on any data point to highlight candidate details in table and 3D visualizer</span>
        <span className="font-mono">Line: lowest enthalpy so far</span>
      </div>
    </div>
  );
};
