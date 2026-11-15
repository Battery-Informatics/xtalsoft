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
      ? { dot: 'bg-emerald-700', label: 'Backend connected' }
      : backendOnline === false
      ? { dot: 'bg-red-700', label: 'Backend offline' }
      : { dot: 'bg-slate-400', label: 'Connecting' };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-1 py-3 md:h-16 md:py-0">
          <span className="text-[17px] font-semibold text-slate-900">XtalOpt Workbench</span>

          <div className="order-last md:order-none w-full md:w-auto -mx-1 flex items-center overflow-x-auto [scrollbar-width:none]">
            <nav className="flex items-center" aria-label="Sections">
              {TABS.map((t) => {
                const active = currentTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setCurrentTab(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
                      active ? 'text-blue-700' : 'text-slate-900 hover:text-blue-700'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500" title={status.label}>
            <span className={`h-2 w-2 rounded-full ${status.dot}`} />
            <span className="hidden sm:inline">{status.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
