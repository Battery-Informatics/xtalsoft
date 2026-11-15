import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Layers, GitBranch, CheckCircle2, Clock, Copy, AlertTriangle } from 'lucide-react';
import type { ParsedStructure } from '../types';

interface CandidateTableProps {
  structures: ParsedStructure[];
  selectedTag?: string | null;
  onSelectStructure: (structure: ParsedStructure) => void;
  onAnalyzeStructure?: (structure: ParsedStructure) => void;
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
  onAnalyzeStructure,
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-slate-900" />
          Optimized
        </span>
      );
    }
    if (st.includes('process') || st.includes('updating')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 ">
          <Clock className="w-3 h-3 text-blue-700" />
          {status}
        </span>
      );
    }
    if (st.includes('wait') || st.includes('submit')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-700" />
          Queued
        </span>
      );
    }
    if (st.includes('sim') || st.includes('duplicate')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <Copy className="w-3 h-3 text-purple-700" />
          {status}
        </span>
      );
    }
    if (st.includes('fail') || st.includes('error') || st.includes('dismiss')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="w-3 h-3 text-red-700" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
        {status}
      </span>
    );
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 inline ml-1 opacity-0 group-hover:opacity-100" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3.5 h-3.5 text-slate-900 inline ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-slate-900 inline ml-1" />
    );
  };

  return (
    <div className="bg-surface border border-slate-200 rounded-lg flex flex-col overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by tag, formula, space group, operator..."
            className="w-full bg-slate-50 border border-slate-300 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-500 focus:outline-none focus:border-blue-600"
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
                  ? 'bg-surface text-slate-900 font-medium border border-slate-300 shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px]">
            <tr>
              <th
                onClick={() => handleSort('rank')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800 group"
              >
                Rank {renderSortIcon('rank')}
              </th>
              <th
                onClick={() => handleSort('tag')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800 group"
              >
                Structure {renderSortIcon('tag')}
              </th>
              <th
                onClick={() => handleSort('formula')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800 group"
              >
                Formula {renderSortIcon('formula')}
              </th>
              <th
                onClick={() => handleSort('enthalpy_per_atom')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800 group text-right"
              >
                H / Atom (eV) {renderSortIcon('enthalpy_per_atom')}
              </th>
              <th
                onClick={() => handleSort('space_group')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800 group"
              >
                Space Group {renderSortIcon('space_group')}
              </th>
              <th
                onClick={() => handleSort('volume')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800 group text-right"
              >
                Volume (Å³) {renderSortIcon('volume')}
              </th>
              <th
                onClick={() => handleSort('density')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800 group text-right"
              >
                Density {renderSortIcon('density')}
              </th>
              <th
                onClick={() => handleSort('status')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800 group"
              >
                Status {renderSortIcon('status')}
              </th>
              <th className="py-2.5 px-3">Parent Lineage</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
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
                        ? 'bg-blue-50 border-l-2 border-blue-600'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <td className="py-2 px-3 font-mono text-slate-600">
                      {s.rank !== null && s.rank !== undefined ? `#${s.rank}` : '-'}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-900 flex items-center gap-1.5">
                      {s.tag}
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-900">
                      {s.formula}
                    </td>
                    <td className="py-2 px-3 font-mono text-right font-medium text-slate-900">
                      {s.enthalpy_per_atom !== null && s.enthalpy_per_atom !== undefined
                        ? s.enthalpy_per_atom.toFixed(4)
                        : '-'}
                    </td>
                    <td className="py-2 px-3">
                      {s.space_group ? (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-500" />
                          <span className="font-medium text-slate-800">{s.space_group.symbol}</span>
                          <span className="text-[10px] text-slate-500">
                            (#{s.space_group.number})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-slate-600">
                      {s.volume ? s.volume.toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-slate-600">
                      {s.density ? s.density.toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-3">
                      {getStatusBadge(s.status)}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-600 truncate max-w-[200px]" title={s.parents || ''}>
                      {s.parents ? (
                        <span className="flex items-center gap-1 font-mono text-slate-600">
                          <GitBranch className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{s.parents}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">initial</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {onAnalyzeStructure && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStructure(s);
                            onAnalyzeStructure(s);
                          }}
                          className="px-2 py-0.5 rounded border border-slate-300 bg-surface hover:bg-slate-100 text-slate-700 text-[11px] font-medium"
                          title="Open in 3D Crystal & Battery Analyzer"
                        >
                          Analyze
                        </button>
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
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
        <span>
          Showing <b className="text-slate-800">{filteredStructures.length}</b> of{' '}
          <b className="text-slate-800">{structures.length}</b> candidates
        </span>
        {selectedTag && (
          <span className="text-slate-900 font-medium flex items-center gap-1.5">
            Selected candidate: <span className="font-mono underline">{selectedTag}</span>
          </span>
        )}
      </div>
    </div>
  );
};
