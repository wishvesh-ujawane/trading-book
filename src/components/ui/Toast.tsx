import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  /** Milliseconds before auto-dismiss. Default 4000. Set to 0 to persist. */
  duration?: number;
}

interface ToastApi {
  show: (tone: ToastTone, title: string, message?: string, duration?: number) => number;
  success: (title: string, message?: string) => number;
  error: (title: string, message?: string) => number;
  info: (title: string, message?: string) => number;
  warning: (title: string, message?: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Hook to push toasts from anywhere below `<ToastProvider>`.
 *   const toast = useToast();
 *   toast.success('Trade saved', 'Your entry is now in the ledger.');
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() must be used inside <ToastProvider>');
  }
  return ctx;
}

const toneStyles: Record<
  ToastTone,
  { icon: ReactNode; ring: string; accentText: string }
> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    ring: 'border-emerald-500/40',
    accentText: 'text-emerald-400',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4" />,
    ring: 'border-rose-500/40',
    accentText: 'text-rose-400',
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    ring: 'border-indigo-500/40',
    accentText: 'text-indigo-400',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    ring: 'border-amber-500/40',
    accentText: 'text-amber-400',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (tone: ToastTone, title: string, message?: string, duration = 4000) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((prev) => [...prev, { id, tone, title, message, duration }]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  // Clean up all timers on unmount.
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, message) => show('success', title, message),
      error: (title, message) => show('error', title, message, 6000),
      info: (title, message) => show('info', title, message),
      warning: (title, message) => show('warning', title, message, 5000),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="false"
            className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
          >
            {toasts.map((t) => {
              const style = toneStyles[t.tone];
              return (
                <div
                  key={t.id}
                  role="status"
                  className={`pointer-events-auto bg-slate-900/95 backdrop-blur border ${style.ring} rounded-xl shadow-lg p-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-2`}
                >
                  <span className={`mt-0.5 shrink-0 ${style.accentText}`}>
                    {style.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{t.title}</p>
                    {t.message && (
                      <p className="text-xs text-slate-400 mt-0.5">{t.message}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => dismiss(t.id)}
                    className="text-slate-500 hover:text-white transition-colors p-1 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
