// Track Your Shit - Main Entry Point
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { initSentry } from "@/lib/sentry";
import App from "./App";
import "@fontsource-variable/jetbrains-mono";
import "./styles/globals.css";

// Initialize Sentry error tracking before React renders
initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
