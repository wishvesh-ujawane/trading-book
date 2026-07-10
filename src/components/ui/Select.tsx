import { forwardRef, useId } from 'react';
import type { SelectHTMLAttributes, ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  children: ReactNode;
}

/**
 * Native select styled to match Input. Uses the same label/hint/error a11y
 * plumbing so both feel consistent.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, wrapperClassName = '', className = '', id, children, ...rest },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const selectClasses = [
    'w-full bg-slate-950/80 border rounded-xl text-sm text-slate-100',
    'px-3 py-2 focus:outline-none focus:ring-1',
    error
      ? 'border-rose-500/60 focus:ring-rose-500 focus:border-rose-500'
      : 'border-slate-800 focus:ring-indigo-500 focus:border-indigo-500',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`flex flex-col gap-1 ${wrapperClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={selectClasses}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </select>
      {hint && !error && (
        <span id={hintId} className="text-[10px] text-slate-500">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-[10px] text-rose-400 font-semibold">
          {error}
        </span>
      )}
    </div>
  );
});
