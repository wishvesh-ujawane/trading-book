import type { ReactNode } from 'react';

interface TabPillGroupProps {
  /** Accessible label for the group. */
  'aria-label': string;
  children: ReactNode;
  className?: string;
}

/**
 * Container for a row of `TabPill`s. Matches the segmented pill-bar used
 * across the app (main nav + Dashboard filters).
 */
export function TabPillGroup({
  'aria-label': ariaLabel,
  children,
  className = '',
}: TabPillGroupProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs font-semibold ${className}`}
    >
      {children}
    </div>
  );
}

interface TabPillProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Optional icon rendered before the label. */
  leadingIcon?: ReactNode;
  /** Overrides the auto `aria-label` (defaults to text children). */
  'aria-label'?: string;
  className?: string;
}

/**
 * A single pill in a `TabPillGroup`. Handles active/inactive styling and
 * exposes correct ARIA state for tablist behavior.
 */
export function TabPill({
  active,
  onClick,
  children,
  leadingIcon,
  'aria-label': ariaLabel,
  className = '',
}: TabPillProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-current={active ? 'page' : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        active
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950'
          : 'text-slate-400 hover:text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
