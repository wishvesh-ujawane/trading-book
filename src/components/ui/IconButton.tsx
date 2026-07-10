import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonVariant = 'default' | 'danger' | 'success';
type IconButtonSize = 'sm' | 'md';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** REQUIRED — icon-only buttons must have an accessible name. */
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: ReactNode;
}

const variants: Record<IconButtonVariant, string> = {
  default:
    'text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 focus-visible:ring-slate-500',
  danger:
    'text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-slate-800 focus-visible:ring-rose-500',
  success:
    'text-slate-400 hover:text-emerald-400 hover:bg-slate-900 border border-slate-800 focus-visible:ring-emerald-500',
};

const sizes: Record<IconButtonSize, string> = {
  sm: 'p-1.5',
  md: 'p-2',
};

/**
 * Square icon-only button. Enforces `aria-label` at the type level so we
 * don't accidentally ship inaccessible icon buttons again.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { variant = 'default', size = 'md', className = '', type = 'button', children, ...rest },
    ref
  ) {
    const classes = [
      'inline-flex items-center justify-center rounded-xl transition-colors cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variants[variant],
      sizes[size],
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button ref={ref} type={type} className={classes} {...rest}>
        {children}
      </button>
    );
  }
);
