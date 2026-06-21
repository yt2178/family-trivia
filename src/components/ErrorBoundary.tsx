import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="glass-panel p-8 rounded-3xl border border-red-500/30 max-w-lg w-full text-center">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-red-400 mb-2">משהו השתבש</h1>
            <p className="text-slate-400 mb-6">
              אירעה שגיאה בלתי צפויה. אנא רענן את הדף ונסה שוב.
            </p>
            {this.state.error && (
              <details className="text-left bg-slate-900 p-4 rounded-xl mb-6">
                <summary className="text-xs text-slate-500 cursor-pointer mb-2">
                  פרטי השגיאה (למפתחים)
                </summary>
                <pre className="text-xs text-red-300 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition-colors"
            >
              רענן את הדף
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
