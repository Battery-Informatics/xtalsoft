import React from 'react';
import {
  BatteryCharging,
  Layers,
  Sparkles,
  Shield,
  Atom,
} from 'lucide-react';
import type { StructureAnalysisResult } from '../types';

interface StructuralCathodeMetricsProps {
  analysis: StructureAnalysisResult;
}

export const StructuralCathodeMetrics: React.FC<StructuralCathodeMetricsProps> = ({ analysis }) => {
  const { lattice, space_group, crystal_system, battery_metrics, bond_analysis, coordination_summary } =
    analysis;

  return (
    <div className="space-y-4">
      {/* 1. Electrochemical Battery Capacity Hero Card */}
      <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-900/60 border border-emerald-600/60 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <BatteryCharging className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400">
                  Theoretical Gravimetric Capacity
                </span>
                <span className="text-[10px] bg-emerald-950 px-2 py-0.5 rounded text-emerald-300 border border-emerald-800">
                  {battery_metrics.formula}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                  {battery_metrics.theoretical_capacity_mah_g.toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-emerald-400">mAh/g</span>
                {battery_metrics.num_li > 0 && (
                  <span className="text-xs text-slate-400 ml-2">
                    ({battery_metrics.num_li} Li extractable / mol)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats on the right */}
          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5">
              <div className="text-[10px] text-slate-500 uppercase">Molar Mass</div>
              <div className="text-sm font-bold text-slate-200">
                {battery_metrics.molar_mass.toFixed(2)} g/mol
              </div>
            </div>

            {battery_metrics.theoretical_insertion_capacity_mah_g !== null &&
              battery_metrics.theoretical_insertion_capacity_mah_g !== undefined && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5">
                  <div className="text-[10px] text-cyan-400 uppercase">Li Insertion Cap</div>
                  <div className="text-sm font-bold text-cyan-300">
                    {battery_metrics.theoretical_insertion_capacity_mah_g.toFixed(1)} mAh/g
                  </div>
                </div>
              )}
          </div>
        </div>

        {battery_metrics.notes && (
          <div className="mt-3 pt-3 border-t border-emerald-900/40 text-xs text-emerald-300/90 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{battery_metrics.notes}</span>
          </div>
        )}
      </div>

      {/* 2. Crystallographic Geometry & Lattice Parameters Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-200 tracking-wide uppercase">
              Crystallographic Lattice & Symmetry
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
              {space_group.symbol} (#{space_group.number})
            </span>
            <span className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {crystal_system}
            </span>
          </div>
        </div>

        {/* 6-lattice parameters grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs font-mono">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">a (Å)</span>
            <span className="text-sm font-bold text-slate-200">{lattice.a.toFixed(3)}</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">b (Å)</span>
            <span className="text-sm font-bold text-slate-200">{lattice.b.toFixed(3)}</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">c (Å)</span>
            <span className="text-sm font-bold text-slate-200">{lattice.c.toFixed(3)}</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">α (°)</span>
            <span className="text-sm font-bold text-slate-200">{lattice.alpha.toFixed(2)}</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">β (°)</span>
            <span className="text-sm font-bold text-slate-200">{lattice.beta.toFixed(2)}</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">γ (°)</span>
            <span className="text-sm font-bold text-slate-200">{lattice.gamma.toFixed(2)}</span>
          </div>
        </div>

        {/* Volume & Density */}
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs font-mono">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-slate-400">Unit Cell Volume</span>
            <span className="font-bold text-slate-200">{lattice.volume.toFixed(2)} Å³</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-slate-400">Mass Density</span>
            <span className="font-bold text-slate-200">{analysis.density.toFixed(2)} g/cm³</span>
          </div>
        </div>
      </div>

      {/* 3. Nearest-Neighbor Coordination & TM-O / Li-O Bond Distances */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-800">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-bold text-slate-200 tracking-wide uppercase">
            Nearest-Neighbor Coordination & Bond Lengths (TM–O & Li–O)
          </h4>
        </div>

        {bond_analysis.length === 0 ? (
          <p className="text-xs text-slate-500">No bond lengths within cutoff recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-950/60 font-semibold">
                <tr>
                  <th className="py-2 px-3">Bond Pair</th>
                  <th className="py-2 px-3 text-right">Min (Å)</th>
                  <th className="py-2 px-3 text-right">Max (Å)</th>
                  <th className="py-2 px-3 text-right">Mean (Å)</th>
                  <th className="py-2 px-3 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {bond_analysis.slice(0, 8).map((b) => {
                  const isLiO = b.pair === 'Li-O';
                  const isTMO = b.pair.endsWith('-O') && b.pair !== 'O-O';
                  return (
                    <tr
                      key={b.pair}
                      className={
                        isLiO
                          ? 'bg-emerald-950/30 font-semibold text-emerald-300'
                          : isTMO
                          ? 'bg-sky-950/20 text-sky-200'
                          : 'hover:bg-slate-800/40 text-slate-300'
                      }
                    >
                      <td className="py-1.5 px-3 flex items-center gap-1.5">
                        <Atom className="w-3 h-3 opacity-60" />
                        {b.pair}
                        {isLiO && (
                          <span className="text-[9px] bg-emerald-900 text-emerald-300 px-1 rounded ml-1 font-sans">
                            Cathode Cation
                          </span>
                        )}
                        {isTMO && !isLiO && (
                          <span className="text-[9px] bg-sky-900 text-sky-300 px-1 rounded ml-1 font-sans">
                            TM Octahedral
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right">{b.min_dist.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-right">{b.max_dist.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-right font-bold">{b.mean_dist.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-right text-slate-400">{b.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Coordination Sites Summary */}
        {coordination_summary.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-2">
              Cation Coordination Numbers (CN)
            </span>
            <div className="flex flex-wrap gap-2">
              {coordination_summary.slice(0, 10).map((s) => (
                <div
                  key={s.index}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 flex items-center gap-1.5"
                >
                  <span className="text-emerald-400 font-bold">{s.label}:</span>
                  <span>CN={s.coordination_number}</span>
                  <span className="text-[10px] text-slate-500">
                    ({Object.entries(s.coordinating_elements).map(([el, c]) => `${c} ${el}`).join(', ')})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
