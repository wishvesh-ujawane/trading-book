import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders an icon before the label. */
  leadingIcon?: ReactNode;
  /** Renders an icon after the label. */
  trailingIcon?: ReactNode;
  /** Stretches the button to fill its parent width. */
  fullWidth?: boolean;
  children?: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 hover:bg-indigo-500 text-white focus-visible:ring-indigo-500',
  secondary:
    'bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800 hover:border-slate-700 focus-visible:ring-slate-500',
  ghost:
    'bg-transparent hover:bg-slate-900 text-slate-400 hover:text-white shadow-none focus-visible:ring-slate-500',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white focus-visible:ring-rose-500',
  warning:
    'bg-amber-500 hover:bg-amber-400 text-slate-950 focus-visible:ring-amber-400',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'text-[10px] py-1 px-2.5',
  md: 'text-xs py-2 px-4',
  lg: 'text-sm py-2.5 px-5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    fullWidth,
    className = '',
    type = 'button',
    children,
    ...rest
  },
  ref
) {
  const classes = [
    base,
    variants[variant],
    sizes[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});
