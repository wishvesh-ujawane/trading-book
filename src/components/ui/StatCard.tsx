import type { ReactNode } from 'react';

export type StatCardAccent = 'emerald' | 'rose' | 'indigo' | 'blue' | 'purple' | 'amber';

interface StatCardProps {
  label: string;
  /** Main value shown large. Pre-formatted string (currency, %, etc.). */
  value: ReactNode;
  /** Optional Tailwind text-color class to override the auto-picked one. */
  valueClassName?: string;
  /** Corner tint. Used for the subtle top-right glow. */
  accent?: StatCardAccent;
  /** Optional row rendered under a divider at the bottom of the card. */
  footer?: ReactNode;
}

const accentGlowClasses: Record<StatCardAccent, string> = {
  emerald: 'bg-emerald-500/5 group-hover:bg-emerald-500/10',
  rose: 'bg-rose-500/5 group-hover:bg-rose-500/10',
  indigo: 'bg-indigo-500/5 group-hover:bg-indigo-500/10',
  blue: 'bg-blue-500/5 group-hover:bg-blue-500/10',
  purple: 'bg-purple-500/5 group-hover:bg-purple-500/10',
  amber: 'bg-amber-500/5 group-hover:bg-amber-500/10',
};

/**
 * KPI card used across the Dashboard. Consolidates the repeated card layout
 * (label, big value, corner glow, optional footer row) so screens describe
 * data instead of markup.
 */
export function StatCard({
  label,
  value,
  valueClassName = 'text-indigo-400',
  accent = 'indigo',
  footer,
}: StatCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition-all">
      <div
        className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full pointer-events-none transition-all ${accentGlowClasses[accent]}`}
        aria-hidden="true"
      />
      <div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
          {label}
        </span>
        <div className={`text-2xl sm:text-3xl font-black mt-2 font-mono ${valueClassName}`}>
          {value}
        </div>
      </div>
      {footer !== undefined && (
        <div className="text-[10px] text-slate-400 mt-4 pt-2 border-t border-slate-800/80">
          {footer}
        </div>
      )}
    </div>
  );
}
