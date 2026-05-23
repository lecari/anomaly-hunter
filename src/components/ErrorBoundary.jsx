import { Component } from "react";

// Last-resort safety net. If any descendant component throws during render
// (e.g., a malformed LLM JSON payload reaches the UI), this catches it before
// React unmounts the entire tree and replaces it with a recoverable message.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-lg rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-center">
            <h1 className="text-xl font-semibold text-rose-100">Something went wrong.</h1>
            <p className="mt-3 text-sm text-rose-200/90 leading-relaxed">
              The app hit an unexpected rendering error. Your data and API key were not sent
              anywhere. Reload the page to start over — your API key will need to be re-entered.
            </p>
            {this.state.error?.message && (
              <pre className="mt-4 text-left text-[11px] font-mono text-rose-200/70 whitespace-pre-wrap bg-rose-950/40 border border-rose-500/30 rounded p-3">
                {String(this.state.error.message).slice(0, 400)}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 rounded-md border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-sm text-rose-100 hover:bg-rose-500/30"
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
