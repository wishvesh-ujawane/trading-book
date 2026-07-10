import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Icon rendered in a circular tinted container. Pass a lucide icon element. */
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  /** Primary call-to-action (usually a `<Button>`). */
  action?: ReactNode;
  /** Additional secondary action, if any. */
  secondaryAction?: ReactNode;
  /** Compact = smaller paddings, for embedded contexts. */
  compact?: boolean;
  /** Accent color for the icon container. */
  tone?: 'indigo' | 'emerald' | 'amber' | 'slate';
  className?: string;
}

const toneClasses = {
  indigo: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  slate: 'bg-slate-800/60 border-slate-700/60 text-slate-400',
};

/**
 * Standard empty-state block: circle-tinted icon, heading, subtext, primary
 * CTA. Use whenever a list or dataset renders zero items.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact,
  tone = 'indigo',
  className = '',
}: EmptyStateProps) {
  const pad = compact ? 'py-10 px-6' : 'py-16 px-6';
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${pad} ${className}`}
    >
      <div
        aria-hidden="true"
        className={`w-14 h-14 rounded-full border flex items-center justify-center ${toneClasses[tone]}`}
      >
        {icon}
      </div>
      <h3 className="mt-4 font-display text-base font-bold text-white">{title}</h3>
      {description && (
        <p className="mt-1.5 text-xs text-slate-400 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
