import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";
import { logger } from "@/utils";
import { Button } from "./ui/button";

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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error("[ErrorBoundary] caught error:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-4">
          <AlertTriangle className="h-12 w-12 text-red-500" />
          <h1 className="text-xl font-semibold text-gray-900">
            Terjadi kesalahan
          </h1>
          <p className="max-w-md text-center text-gray-600">
            Aplikasi mengalami kesalahan tak terduga. Silakan coba lagi.
          </p>
          {this.state.error && (
            <pre className="max-w-md overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-500">
              {this.state.error.message}
            </pre>
          )}
          <Button onClick={this.handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Coba Lagi
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
