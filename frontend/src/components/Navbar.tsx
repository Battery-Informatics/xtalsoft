import React from 'react';

type Tab = 'studio' | 'presets' | 'runs' | 'analyzer';

interface NavbarProps {
  currentTab: Tab;
  setCurrentTab: (tab: Tab) => void;
  backendOnline: boolean | null;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'studio', label: 'Experiment Studio' },
  { id: 'presets', label: 'Presets' },
  { id: 'runs', label: 'Runs' },
  { id: 'analyzer', label: 'Structure Analysis' },
];

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, backendOnline }) => {
  const status =
    backendOnline === true
      ? { dot: 'bg-emerald-500', label: 'Backend connected' }
      : backendOnline === false
      ? { dot: 'bg-red-500', label: 'Backend offline' }
      : { dot: 'bg-slate-400', label: 'Connecting' };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between gap-6">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-semibold text-[15px] text-slate-900 tracking-tight">XtalOpt Workbench</span>
            <span className="hidden sm:inline text-xs text-slate-500">Battery materials structure search</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600" title={status.label}>
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            <span className="hidden sm:inline">{status.label}</span>
          </div>
        </div>

        <nav className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]" aria-label="Sections">
          {TABS.map((t) => {
            const active = currentTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setCurrentTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm transition-colors ${
                  active
                    ? 'border-blue-600 text-slate-900 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
