import type { ReactNode } from 'react';

interface ProgressRingProps {
  /** Progress from 0 to 1. Values outside are clamped for the ring visual
   *  but the caller can still show >100% in the label if desired. */
  value: number;
  /** Ring diameter in px. Default 96. */
  size?: number;
  /** Ring stroke width in px. Default 8. */
  strokeWidth?: number;
  /** Center content (usually the formatted value). */
  children?: ReactNode;
  /** Small label rendered under the ring (metric name). */
  label?: string;
  /** Sub-label rendered under the main label (e.g. "vs. ₹10,000 target"). */
  hint?: string;
  /** Accessible description read aloud (e.g. "62% of monthly profit goal"). */
  'aria-label'?: string;
  /** Tailwind color class for the progress arc. */
  colorClass?: string;
  /** Tailwind color class for the track behind the arc. */
  trackClass?: string;
}

/**
 * Circular progress ring driven by SVG stroke-dashoffset. Pure presentational
 * component — caller computes the 0..1 progress fraction.
 */
export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  children,
  label,
  hint,
  'aria-label': ariaLabel,
  colorClass = 'text-indigo-400',
  trackClass = 'text-slate-800',
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={ariaLabel ?? label ?? 'Progress'}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
          className="-rotate-90"
        >
          <circle
            className={trackClass}
            stroke="currentColor"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className={`${colorClass} transition-[stroke-dashoffset] duration-500 ease-out`}
            stroke="currentColor"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      </div>
      {(label || hint) && (
        <div className="space-y-0.5">
          {label && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              {label}
            </p>
          )}
          {hint && <p className="text-[10px] text-slate-500 font-mono">{hint}</p>}
        </div>
      )}
    </div>
  );
}
