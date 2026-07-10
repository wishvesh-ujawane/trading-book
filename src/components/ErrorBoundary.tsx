import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback renderer. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render-time / lifecycle errors anywhere
 * below it, logs them to the console, and shows a recoverable fallback UI.
 * Wrap the root of the app tree (see main.tsx).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-6">
        <div
          role="alert"
          className="max-w-lg w-full bg-slate-900/70 border border-rose-500/30 rounded-2xl p-6 sm:p-8 shadow-xl"
        >
          <div className="flex items-start gap-4">
            <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-2 shrink-0">
              <svg
                aria-hidden="true"
                className="w-6 h-6 text-rose-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="font-display text-lg font-bold text-white">
                  Something went wrong
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  The app hit an unexpected error and had to stop. Your saved data
                  is not affected.
                </p>
              </div>
              <details className="text-xs bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-slate-400">
                <summary className="cursor-pointer font-semibold text-slate-300">
                  Technical details
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-rose-300/90">
                  {error.message}
                </pre>
              </details>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={this.reset}
                  className="inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-all shadow-md cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 px-4"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-all shadow-md cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800 hover:border-slate-700 text-xs py-2 px-4"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
