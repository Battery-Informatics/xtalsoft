import React from 'react';
import { Atom } from 'lucide-react';
import type { StructureAnalysisResult } from '../types';

interface StructuralCathodeMetricsProps {
  analysis: StructureAnalysisResult;
}

export const StructuralCathodeMetrics: React.FC<StructuralCathodeMetricsProps> = ({ analysis }) => {
  const { lattice, space_group, crystal_system, battery_metrics, bond_analysis, coordination_summary } =
    analysis;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-xs font-medium text-slate-500">Theoretical gravimetric capacity</h4>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-3xl font-semibold tabular-nums text-slate-900">
                {battery_metrics.theoretical_capacity_mah_g.toFixed(1)}
              </span>
              <span className="text-sm text-slate-600">mAh/g</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              <span className="font-mono">{battery_metrics.formula}</span>
              {battery_metrics.num_li > 0 && <> · {battery_metrics.num_li} Li extractable per formula unit</>}
            </p>
          </div>

          <dl className="flex gap-6 text-xs">
            <div>
              <dt className="text-slate-500">Molar mass</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-900">
                {battery_metrics.molar_mass.toFixed(2)} g/mol
              </dd>
            </div>
            {battery_metrics.theoretical_insertion_capacity_mah_g !== null &&
              battery_metrics.theoretical_insertion_capacity_mah_g !== undefined && (
                <div>
                  <dt className="text-slate-500">Li insertion capacity</dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-900">
                    {battery_metrics.theoretical_insertion_capacity_mah_g.toFixed(1)} mAh/g
                  </dd>
                </div>
              )}
          </dl>
        </div>

        {battery_metrics.notes && (
          <p className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">{battery_metrics.notes}</p>
        )}
      </div>

      {/* 2. Crystallographic Geometry & Lattice Parameters Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 ">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">
              Lattice and symmetry
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {space_group.symbol} (#{space_group.number})
            </span>
            <span className="text-xs text-slate-600">
              {crystal_system}
            </span>
          </div>
        </div>

        {/* 6-lattice parameters grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs font-mono">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">a (Å)</span>
            <span className="text-sm font-semibold text-slate-800">{lattice.a.toFixed(3)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">b (Å)</span>
            <span className="text-sm font-semibold text-slate-800">{lattice.b.toFixed(3)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">c (Å)</span>
            <span className="text-sm font-semibold text-slate-800">{lattice.c.toFixed(3)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">α (°)</span>
            <span className="text-sm font-semibold text-slate-800">{lattice.alpha.toFixed(2)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">β (°)</span>
            <span className="text-sm font-semibold text-slate-800">{lattice.beta.toFixed(2)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">γ (°)</span>
            <span className="text-sm font-semibold text-slate-800">{lattice.gamma.toFixed(2)}</span>
          </div>
        </div>

        {/* Volume & Density */}
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs font-mono">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-slate-600">Unit Cell Volume</span>
            <span className="font-semibold text-slate-800">{lattice.volume.toFixed(2)} Å³</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-slate-600">Mass Density</span>
            <span className="font-semibold text-slate-800">{analysis.density.toFixed(2)} g/cm³</span>
          </div>
        </div>
      </div>

      {/* 3. Nearest-Neighbor Coordination & TM-O / Li-O Bond Distances */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 ">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">
            Nearest-Neighbor Coordination & Bond Lengths (TM–O & Li–O)
          </h4>
        </div>

        {bond_analysis.length === 0 ? (
          <p className="text-xs text-slate-500">No bond lengths within cutoff recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 font-semibold">
                <tr>
                  <th className="py-2 px-3">Bond Pair</th>
                  <th className="py-2 px-3 text-right">Min (Å)</th>
                  <th className="py-2 px-3 text-right">Max (Å)</th>
                  <th className="py-2 px-3 text-right">Mean (Å)</th>
                  <th className="py-2 px-3 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {bond_analysis.slice(0, 8).map((b) => {
                  const isLiO = b.pair === 'Li-O';
                  const isTMO = b.pair.endsWith('-O') && b.pair !== 'O-O';
                  return (
                    <tr
                      key={b.pair}
                      className={
                        isLiO
                          ? 'bg-emerald-50 font-semibold text-emerald-700'
                          : isTMO
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-slate-100 text-slate-700'
                      }
                    >
                      <td className="py-1.5 px-3 flex items-center gap-1.5">
                        <Atom className="w-3 h-3 opacity-60" />
                        {b.pair}
                        {isLiO && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1 rounded ml-1 font-sans">
                            Cathode Cation
                          </span>
                        )}
                        {isTMO && !isLiO && (
                          <span className="text-[9px] bg-blue-50 text-blue-700 px-1 rounded ml-1 font-sans">
                            TM Octahedral
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right">{b.min_dist.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-right">{b.max_dist.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-right font-semibold">{b.mean_dist.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-right text-slate-600">{b.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Coordination Sites Summary */}
        {coordination_summary.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-semibold block mb-2">
              Cation Coordination Numbers (CN)
            </span>
            <div className="flex flex-wrap gap-2">
              {coordination_summary.slice(0, 10).map((s) => (
                <div
                  key={s.index}
                  className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-700 flex items-center gap-1.5"
                >
                  <span className="text-slate-900 font-semibold">{s.label}:</span>
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
