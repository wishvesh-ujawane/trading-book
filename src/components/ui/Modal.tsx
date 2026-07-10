import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional supporting text under the title. */
  description?: string;
  children: ReactNode;
  /** Footer actions (typically Buttons), rendered right-aligned. */
  footer?: ReactNode;
  /** Max-width Tailwind class. Defaults to `max-w-lg`. */
  maxWidth?: string;
  /** Disable close-on-backdrop-click. Useful for destructive confirms. */
  dismissOnBackdrop?: boolean;
}

/**
 * Portal-rendered modal dialog.
 * - Backdrop click closes (opt-out via `dismissOnBackdrop={false}`).
 * - Escape key closes.
 * - Focus moves into the dialog on open and restores to the previous focus
 *   target on close.
 * - Locks body scroll while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-lg',
  dismissOnBackdrop = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus management: capture the previously focused element on open,
  // move focus into the dialog, restore on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Move focus into the dialog after render.
    const raf = requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (first ?? dialogRef.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Escape to close + body scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
        }}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-start gap-4 p-5 sm:p-6 border-b border-slate-800/80">
          <div className="flex-1 min-w-0">
            <h2 id="modal-title" className="font-display text-lg font-bold text-white">
              {title}
            </h2>
            {description && (
              <p id="modal-description" className="text-xs text-slate-400 mt-1">
                {description}
              </p>
            )}
          </div>
          <IconButton aria-label="Close dialog" onClick={onClose}>
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-sm text-slate-200">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800/80 bg-slate-950/40 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
