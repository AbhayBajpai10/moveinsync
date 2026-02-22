// ============================================================
// components/error/MapErrorBoundary.tsx
// ============================================================
'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props  { children: ReactNode; }
interface State  { hasError: boolean; error: Error | null; }

/**
 * Catches render errors from MapContainer (WebGL failures, Mapbox crashes,
 * missing token, etc.) and renders a friendly fallback instead of a blank screen.
 */
export default class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production, send to your error-tracking service (Sentry, Datadog, etc.)
    console.error('[MapErrorBoundary] Map crashed:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="w-full h-full bg-slate-950 flex items-center justify-center"
      >
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-sm text-center space-y-4 shadow-2xl">
          <div className="flex justify-center">
            <div className="p-3 bg-red-950/50 rounded-full">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Map failed to load</h2>
            <p className="text-slate-400 text-sm mt-2">
              {this.state.error?.message?.includes('token') ||
              this.state.error?.message?.includes('token')
                ? 'Mapbox token may be missing or invalid.'
                : 'An unexpected error occurred with the map renderer.'}
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre className="text-xs text-red-400 bg-slate-950 rounded p-3 mt-3 text-left overflow-auto max-h-32">
                {this.state.error?.message}
              </pre>
            )}
          </div>
          <button
            onClick={this.handleRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }
}