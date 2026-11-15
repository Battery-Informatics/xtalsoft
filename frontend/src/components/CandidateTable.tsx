import React, { useState, useMemo } from 'react';
import type { ParsedStructure } from '../types';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  GitBranch,
  CheckCircle2,
  Clock,
  Copy,
  AlertTriangle,
} from 'lucide-react';

interface CandidateTableProps {
  structures: ParsedStructure[];
  selectedTag?: string | null;
  onSelectStructure: (structure: ParsedStructure) => void;
}

type SortField =
  | 'index'
  | 'rank'
  | 'tag'
  | 'formula'
  | 'enthalpy_per_atom'
  | 'volume'
  | 'density'
  | 'space_group'
  | 'status';

export const CandidateTable: React.FC<CandidateTableProps> = ({
  structures,
  selectedTag,
  onSelectStructure,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('enthalpy_per_atom');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filter and sort structures
  const filteredStructures = useMemo(() => {
    return structures
      .filter((s) => {
        // Status filter
        if (statusFilter !== 'all') {
          const st = (s.status || '').toLowerCase();
          if (statusFilter === 'optimized' && !st.includes('optim')) return false;
          if (statusFilter === 'inprocess' && (!st.includes('process') && !st.includes('updating'))) return false;
          if (statusFilter === 'queued' && (!st.includes('wait') && !st.includes('submit'))) return false;
          if (statusFilter === 'duplicate' && (!st.includes('sim') && !st.includes('duplicate'))) return false;
          if (statusFilter === 'failed' && (!st.includes('fail') && !st.includes('error') && !st.includes('dismiss'))) return false;
        }

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const tag = s.tag.toLowerCase();
        const formula = s.formula.toLowerCase();
        const sg = s.space_group?.symbol?.toLowerCase() || '';
        const sgNum = s.space_group?.number?.toString() || '';
        const parents = (s.parents || '').toLowerCase();

        return (
          tag.includes(q) ||
          formula.includes(q) ||
          sg.includes(q) ||
          sgNum.includes(q) ||
          parents.includes(q)
        );
      })
      .sort((a, b) => {
        let valA: any = a[sortField as keyof ParsedStructure];
        let valB: any = b[sortField as keyof ParsedStructure];

        if (sortField === 'space_group') {
          valA = a.space_group?.number ?? 999;
          valB = b.space_group?.number ?? 999;
        }

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [structures, statusFilter, searchQuery, sortField, sortAsc]);

  const getStatusBadge = (status: string) => {
    const st = status.toLowerCase();
    if (st.includes('optim')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Optimized
        </span>
      );
    }
    if (st.includes('process') || st.includes('updating')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-950/80 text-sky-300 border border-sky-800/80 animate-pulse">
          <Clock className="w-3 h-3 text-sky-400" />
          {status}
        </span>
      );
    }
    if (st.includes('wait') || st.includes('submit')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/80">
          <Clock className="w-3 h-3 text-amber-400" />
          Queued
        </span>
      );
    }
    if (st.includes('sim') || st.includes('duplicate')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-950/80 text-purple-300 border border-purple-800/80">
          <Copy className="w-3 h-3 text-purple-400" />
          {status}
        </span>
      );
    }
    if (st.includes('fail') || st.includes('error') || st.includes('dismiss')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-950/80 text-red-300 border border-red-800/80">
          <AlertTriangle className="w-3 h-3 text-red-400" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
        {status}
      </span>
    );
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 inline ml-1 opacity-0 group-hover:opacity-100" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-400 inline ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-400 inline ml-1" />
    );
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col shadow-xl backdrop-blur-sm overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by tag, formula, space group, operator..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filter Badges */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'optimized', label: 'Optimized' },
            { id: 'inprocess', label: 'Optimizing' },
            { id: 'queued', label: 'Queued' },
            { id: 'duplicate', label: 'Duplicates' },
            { id: 'failed', label: 'Failed' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusFilter === pill.id
                  ? 'bg-slate-800 text-emerald-400 font-medium border border-emerald-500/30'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
            <tr>
              <th
                onClick={() => handleSort('rank')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200 group"
              >
                Rank {renderSortIcon('rank')}
              </th>
              <th
                onClick={() => handleSort('tag')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200 group"
              >
                Structure {renderSortIcon('tag')}
              </th>
              <th
                onClick={() => handleSort('formula')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200 group"
              >
                Formula {renderSortIcon('formula')}
              </th>
              <th
                onClick={() => handleSort('enthalpy_per_atom')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200 group text-right"
              >
                H / Atom (eV) {renderSortIcon('enthalpy_per_atom')}
              </th>
              <th
                onClick={() => handleSort('space_group')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200 group"
              >
                Space Group {renderSortIcon('space_group')}
              </th>
              <th
                onClick={() => handleSort('volume')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200 group text-right"
              >
                Volume (Å³) {renderSortIcon('volume')}
              </th>
              <th
                onClick={() => handleSort('density')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200 group text-right"
              >
                Density {renderSortIcon('density')}
              </th>
              <th
                onClick={() => handleSort('status')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200 group"
              >
                Status {renderSortIcon('status')}
              </th>
              <th className="py-2.5 px-3">Parent Lineage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredStructures.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  No matching candidates found in this experiment.
                </td>
              </tr>
            ) : (
              filteredStructures.map((s) => {
                const isSelected = selectedTag === s.tag;
                return (
                  <tr
                    key={s.tag}
                    onClick={() => onSelectStructure(s)}
                    className={`cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? 'bg-emerald-950/40 border-l-2 border-emerald-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-2 px-3 font-mono text-slate-400">
                      {s.rank !== null && s.rank !== undefined ? `#${s.rank}` : '-'}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-100 flex items-center gap-1.5">
                      {s.tag}
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-emerald-300">
                      {s.formula}
                    </td>
                    <td className="py-2 px-3 font-mono text-right font-medium text-slate-100">
                      {s.enthalpy_per_atom !== null && s.enthalpy_per_atom !== undefined
                        ? s.enthalpy_per_atom.toFixed(4)
                        : '-'}
                    </td>
                    <td className="py-2 px-3">
                      {s.space_group ? (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-500" />
                          <span className="font-medium text-slate-200">{s.space_group.symbol}</span>
                          <span className="text-[10px] text-slate-500">
                            (#{s.space_group.number})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-slate-400">
                      {s.volume ? s.volume.toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-slate-400">
                      {s.density ? s.density.toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-3">
                      {getStatusBadge(s.status)}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-400 truncate max-w-[200px]" title={s.parents || ''}>
                      {s.parents ? (
                        <span className="flex items-center gap-1 font-mono text-slate-400">
                          <GitBranch className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{s.parents}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">initial</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer bar */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>
          Showing <b className="text-slate-200">{filteredStructures.length}</b> of{' '}
          <b className="text-slate-200">{structures.length}</b> candidates
        </span>
        {selectedTag && (
          <span className="text-emerald-400 font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Selected candidate: <span className="font-mono underline">{selectedTag}</span>
          </span>
        )}
      </div>
    </div>
  );
};
