// Track Your Shit - Error Boundary Component
// Catches React runtime errors to prevent white-screen crashes
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Component, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { captureError } from "@/lib/sentry";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback component to render on error */
  fallback?: ReactNode;
  /** If true, shows a compact inline error instead of full-page */
  inline?: boolean;
  /** Label for the boundary (shown in error UI) */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Capture error in Sentry with component stack context
    captureError(error, { componentStack: errorInfo.componentStack });
    
    // Log to Tauri backend for persistent debugging
    const label = this.props.label ?? "unknown";
    const details = `[ErrorBoundary:${label}] ${error.message}\n${errorInfo.componentStack}`;
    invoke("log_frontend_error", { error: details }).catch(() => {
      // Silently ignore if Tauri command not available
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    if (this.props.inline) {
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              {this.props.label ? `${this.props.label} failed to load` : "Something went wrong"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {this.state.error?.message}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full min-h-[400px] p-8">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {this.props.label
                ? `An error occurred in ${this.props.label}.`
                : "An unexpected error occurred."}
            </p>
            {this.state.error && (
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-32 text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={this.handleReset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button variant="secondary" onClick={this.handleReload}>
                Reload App
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
