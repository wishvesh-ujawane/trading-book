import type { ReactNode } from 'react';
import { BarChart3, BookOpen, Briefcase, Plus } from 'lucide-react';

type TabKey = 'DASHBOARD' | 'TRADES_LOG' | 'BROKER_SETTINGS';

interface BottomTabBarProps {
  activeTab: TabKey;
  isLoggingTrade: boolean;
  onSelectTab: (tab: TabKey) => void;
  onNewTrade: () => void;
}

interface TabDef {
  key: TabKey;
  label: string;
  icon: ReactNode;
}

const TABS: TabDef[] = [
  { key: 'DASHBOARD', label: 'Dashboard', icon: <BarChart3 className="w-5 h-5" /> },
  { key: 'TRADES_LOG', label: 'Journal', icon: <BookOpen className="w-5 h-5" /> },
  { key: 'BROKER_SETTINGS', label: 'Brokers', icon: <Briefcase className="w-5 h-5" /> },
];

/**
 * Fixed bottom navigation bar shown only below the `md` breakpoint. Includes
 * the three top-level tabs and a raised "+" quick-add button in the middle.
 *
 * Respects iOS safe-area insets via the `pb-[env(safe-area-inset-bottom)]`
 * utility, so the raised button sits above the home-indicator on notched
 * devices.
 */
export function BottomTabBar({
  activeTab,
  isLoggingTrade,
  onSelectTab,
  onNewTrade,
}: BottomTabBarProps) {
  const [left, right] = [TABS[0], TABS[1]];
  const trailing = TABS[2];

  return (
    <nav
      aria-label="Primary navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 pointer-events-none"
    >
      <div
        className="pointer-events-auto bg-slate-950/90 backdrop-blur-md border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="relative grid grid-cols-5 items-end px-2 pt-2 pb-1">
          <TabButton
            tab={left}
            active={activeTab === left.key && !isLoggingTrade}
            onClick={() => onSelectTab(left.key)}
          />
          <TabButton
            tab={right}
            active={activeTab === right.key && !isLoggingTrade}
            onClick={() => onSelectTab(right.key)}
          />

          {/* Raised quick-add button (middle column). */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onNewTrade}
              aria-label="Log a new trade"
              className="-mt-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl p-3 shadow-xl shadow-indigo-950/60 border-4 border-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Plus className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <TabButton
            tab={trailing}
            active={activeTab === trailing.key && !isLoggingTrade}
            onClick={() => onSelectTab(trailing.key)}
          />
          {/* Spacer to keep the "+" button centered — the 5th column. */}
          <span aria-hidden="true" />
        </div>
      </div>
    </nav>
  );
}

interface TabButtonProps {
  tab: TabDef;
  active: boolean;
  onClick: () => void;
}

function TabButton({ tab, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-current={active ? 'page' : undefined}
      aria-label={tab.label}
      onClick={onClick}
      className={[
        'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-200',
      ].join(' ')}
    >
      {tab.icon}
      <span className="text-[10px] font-semibold">{tab.label}</span>
    </button>
  );
}
