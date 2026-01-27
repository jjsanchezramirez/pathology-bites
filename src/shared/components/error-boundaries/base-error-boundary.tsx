"use client";

import React from "react";
import dynamic from "next/dynamic";

import { Button } from "@/shared/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Full-screen page-level error component with Lottie animation
function PageLevelError({ retry, goHome }: { retry: () => void; goHome?: () => void }) {
  const { animationData } = useLottieAnimation("access_denied");

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        {/* Lottie Animation */}
        {animationData && (
          <div className="w-full max-w-[150px] mx-auto">
            <Lottie
              animationData={animationData}
              loop={true}
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            We encountered an unexpected error while loading this page. Please try again or return
            to the dashboard.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center justify-center gap-3 pt-4">
          <Button
            onClick={retry}
            size="lg"
            className="flex items-center justify-center gap-2 py-6 text-lg w-full max-w-xs"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </Button>

          {goHome && (
            <Button
              onClick={goHome}
              size="lg"
              variant="ghost"
              className="flex items-center justify-center gap-2 py-6 text-lg w-full max-w-xs"
            >
              <Home className="w-5 h-5" />
              Back to Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface BaseErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error;
    retry: () => void;
    goHome?: () => void;
    goBack?: () => void;
  }>;
  level?: "page" | "feature" | "component";
  context?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class BaseErrorBoundary extends React.Component<BaseErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: BaseErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `ErrorBoundary (${this.props.level || "unknown"}) caught an error:`,
      error,
      errorInfo
    );

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Don't call setState here to avoid infinite loops
    // The error state is already set in getDerivedStateFromError
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  goHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
  };

  goBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            retry={this.retry}
            goHome={this.props.showHomeButton ? this.goHome : undefined}
            goBack={this.props.showBackButton ? this.goBack : undefined}
          />
        );
      }

      const { level = "component", showHomeButton } = this.props;
      const isPageLevel = level === "page";

      // Page-level error: Full-screen design with Lottie animation
      if (isPageLevel) {
        return (
          <PageLevelError retry={this.retry} goHome={showHomeButton ? this.goHome : undefined} />
        );
      }

      // Component/Feature-level error: Compact design
      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-red-500 mb-2">
              <AlertTriangle className="h-8 w-8 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Something went wrong
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This component failed to load
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={this.retry} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              {showHomeButton && (
                <Button onClick={this.goHome} variant="outline" size="sm">
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}
