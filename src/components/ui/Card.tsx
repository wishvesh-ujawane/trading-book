import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

type CardTone = 'default' | 'muted' | 'raised';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  as?: 'div' | 'section' | 'article';
  children: ReactNode;
}

const toneClasses: Record<CardTone, string> = {
  // Standard bento surface used across the app.
  default: 'bg-slate-900/50 border border-slate-800 backdrop-blur-md',
  // Slightly translucent, used for banners / secondary blocks.
  muted: 'bg-slate-900/30 border border-slate-800/80',
  // Opaque with a hover accent — used for the KPI cards.
  raised:
    'bg-slate-900/90 border border-slate-800 shadow-lg hover:border-slate-700 transition-all',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6 sm:p-8',
};

/**
 * Rounded bento-style card. Matches the surface treatment used everywhere in
 * the app so screens can compose consistent surfaces without repeating
 * `bg-slate-900/... border border-slate-800 rounded-2xl` incantations.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone = 'default', padding = 'md', as: Tag = 'div', className = '', children, ...rest },
  ref
) {
  const classes = [
    'rounded-2xl',
    toneClasses[tone],
    paddingClasses[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const Component = Tag as 'div';
  return (
    <Component ref={ref} className={classes} {...rest}>
      {children}
    </Component>
  );
});
