import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-ink flex items-center justify-center p-6" dir="rtl">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-brick/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-brick-soft" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">حدث خطأ غير متوقع</h2>
            <p className="text-fg-3 mb-2">
              نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.
            </p>
            {this.state.error && (
              <p className="text-xs text-fg-4/70 mb-6 font-mono text-left" dir="ltr">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-brass hover:bg-brass-hover text-white px-6 py-3 rounded-xl font-medium transition-colors mx-auto"
            >
              <RotateCcw className="w-4 h-4" />
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
