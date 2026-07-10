import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button as danger (red) — for destructive actions. */
  destructive?: boolean;
}

type Confirmer = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirmer | null>(null);

/**
 * Hook returning an imperative `confirm({...})` function that resolves to
 * `true` when the user clicks the confirm button, `false` otherwise
 * (cancel button, backdrop click, or Escape).
 */
export function useConfirm(): Confirmer {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm() must be used inside <ConfirmDialogProvider>');
  }
  return ctx;
}

interface DialogState extends ConfirmOptions {
  open: boolean;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>({
    open: false,
    title: '',
  });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirmer>((opts) => {
    setState({ open: true, ...opts });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    setState((s) => ({ ...s, open: false }));
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={state.open}
        onClose={() => finish(false)}
        title={state.title}
        maxWidth="max-w-md"
        dismissOnBackdrop={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => finish(false)}>
              {state.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={state.destructive ? 'danger' : 'primary'}
              onClick={() => finish(true)}
            >
              {state.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {typeof state.message === 'string' || !state.message ? (
          <p className="text-slate-300 leading-relaxed">{state.message}</p>
        ) : (
          state.message
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
