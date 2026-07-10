import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Optional icon rendered inside the input on the left. */
  leadingIcon?: ReactNode;
  /** Class applied to the outer wrapper (label + input). */
  wrapperClassName?: string;
}

/**
 * Standard text input matching the app's slate/indigo styling. Automatically
 * wires up `<label htmlFor>` + `aria-describedby` so labels, hints, and
 * errors are announced by screen readers.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leadingIcon,
    wrapperClassName = '',
    className = '',
    id,
    ...rest
  },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const inputClasses = [
    'w-full bg-slate-950/80 border rounded-xl text-sm text-slate-100 placeholder:text-slate-500',
    'px-3 py-2 focus:outline-none focus:ring-1',
    leadingIcon ? 'pl-9' : '',
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
          htmlFor={inputId}
          className="text-[10px] font-bold uppercase tracking-widest text-slate-500"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      </div>
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
