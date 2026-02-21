// Track Your Shit - Test Utilities
// Shared render helper with all required providers
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TerminalProvider } from "@/contexts/terminal-context";

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  routerProps?: MemoryRouterProps;
  queryClient?: QueryClient;
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function AllProviders({
  children,
  routerProps,
  queryClient,
}: {
  children: React.ReactNode;
  routerProps?: MemoryRouterProps;
  queryClient?: QueryClient;
}) {
  const client = queryClient ?? createTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      <TerminalProvider>
        <MemoryRouter {...routerProps}>{children}</MemoryRouter>
      </TerminalProvider>
    </QueryClientProvider>
  );
}

function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { routerProps, queryClient, ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders routerProps={routerProps} queryClient={queryClient}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
}

export * from "@testing-library/react";
export { customRender as render, createTestQueryClient };
