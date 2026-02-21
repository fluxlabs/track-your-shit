// Track Your Shit - Sentry Error Tracking Integration
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.log('[sentry] No DSN configured, error tracking disabled');
    return;
  }
  
  Sentry.init({
    dsn,
    environment: import.meta.env.DEV ? 'development' : 'production',
    release: import.meta.env.VITE_APP_VERSION || '0.1.0',
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.DEV ? 0 : 1.0,
    beforeSend(event) {
      // Strip sensitive data
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
      }
      return event;
    },
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

export function setUser(id: string) {
  Sentry.setUser({ id });
}

export { Sentry };
