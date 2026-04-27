import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Uncaught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] p-8 max-w-md w-full text-center">
            <p className="text-text-primary font-semibold mb-2">Something went wrong</p>
            <p className="text-text-secondary text-sm mb-6">An unexpected error occurred on this page.</p>
            <button
              onClick={() => window.location.reload()}
              className="touch-target bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-full px-6 py-2 transition-colors duration-150"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
