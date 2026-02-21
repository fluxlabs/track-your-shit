-- Control Tower - Demo Data Seed Script
-- Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
--
-- Usage: sqlite3 "$DB_PATH" < scripts/seed-demo-data.sql
-- Seeds the database with realistic demo data for screenshots.

-- ============================================================================
-- PROJECTS
-- ============================================================================

INSERT OR IGNORE INTO projects (id, name, path, description, tech_stack, config, status, is_favorite, created_at, updated_at) VALUES
  ('proj-saas-dashboard-01', 'SaaS Dashboard', '/Users/demo/projects/saas-dashboard',
   'A full-stack analytics dashboard with real-time metrics, user management, and billing integration.',
   '{"languages":["TypeScript","Rust"],"frameworks":["Next.js","Tailwind CSS","Prisma"],"has_autopilot":true,"has_planning":true}',
   '{"model_profile":"quality","workflow_mode":"autonomous"}',
   'active', 1,
   datetime('now', '-14 days'), datetime('now', '-1 hour')),

  ('proj-mobile-app-02', 'Mobile App', '/Users/demo/projects/mobile-app',
   'Cross-platform mobile application for task management with offline sync and push notifications.',
   '{"languages":["TypeScript","Swift","Kotlin"],"frameworks":["React Native","Expo"],"has_autopilot":true}',
   '{"model_profile":"balanced"}',
   'active', 0,
   datetime('now', '-21 days'), datetime('now', '-3 hours')),

  ('proj-api-gateway-03', 'API Gateway', '/Users/demo/projects/api-gateway',
   'High-performance API gateway with rate limiting, authentication, and request transformation.',
   '{"languages":["Rust","Go"],"frameworks":["Axum","Tokio"]}',
   '{}',
   'active', 0,
   datetime('now', '-7 days'), datetime('now', '-6 hours'));

-- ============================================================================
-- FLIGHT PLANS
-- ============================================================================

-- SaaS Dashboard flight plan
INSERT OR IGNORE INTO flight_plans (id, project_id, name, description, total_phases, completed_phases, total_tasks, completed_tasks, estimated_cost, actual_cost, status, created_at, updated_at) VALUES
  ('fp-saas-01', 'proj-saas-dashboard-01', 'v1.0 Launch Plan',
   'Full implementation plan for the SaaS Dashboard MVP including auth, analytics, billing, and deployment.',
   5, 3, 18, 12, 45.00, 32.50, 'in_progress',
   datetime('now', '-14 days'), datetime('now', '-1 hour'));

-- Mobile App flight plan
INSERT OR IGNORE INTO flight_plans (id, project_id, name, description, total_phases, completed_phases, total_tasks, completed_tasks, estimated_cost, actual_cost, status, created_at, updated_at) VALUES
  ('fp-mobile-01', 'proj-mobile-app-02', 'v2.0 Feature Release',
   'Major feature release adding offline sync, push notifications, and new task views.',
   4, 2, 14, 8, 35.00, 18.75, 'in_progress',
   datetime('now', '-21 days'), datetime('now', '-3 hours'));

-- API Gateway flight plan
INSERT OR IGNORE INTO flight_plans (id, project_id, name, description, total_phases, completed_phases, total_tasks, completed_tasks, estimated_cost, actual_cost, status, created_at, updated_at) VALUES
  ('fp-api-01', 'proj-api-gateway-03', 'Initial Build',
   'Core gateway implementation with routing, auth middleware, and rate limiting.',
   3, 1, 10, 4, 25.00, 8.20, 'in_progress',
   datetime('now', '-7 days'), datetime('now', '-6 hours'));

-- ============================================================================
-- PHASES — SaaS Dashboard (5 phases)
-- ============================================================================

INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, estimated_minutes, actual_minutes, started_at, completed_at, created_at) VALUES
  ('ph-saas-01', 'fp-saas-01', 1, 'Project Scaffolding', 'Set up Next.js project with Prisma, auth, and base layout.', 'Establish project foundation with all core dependencies', 'completed', 4, 4, 8.00, 6.20, 0, 45, 38,
   datetime('now', '-14 days'), datetime('now', '-13 days'), datetime('now', '-14 days')),

  ('ph-saas-02', 'fp-saas-01', 2, 'Dashboard Core', 'Build the main dashboard layout with chart components and data fetching.', 'Deliver interactive analytics dashboard with real-time data', 'completed', 4, 4, 10.00, 8.50, 1, 60, 52,
   datetime('now', '-12 days'), datetime('now', '-10 days'), datetime('now', '-12 days')),

  ('ph-saas-03', 'fp-saas-01', 3, 'User Management', 'Implement user CRUD, roles, invitations, and team settings.', 'Complete user management system with RBAC', 'completed', 4, 4, 12.00, 9.80, 2, 90, 75,
   datetime('now', '-9 days'), datetime('now', '-7 days'), datetime('now', '-9 days')),

  ('ph-saas-04', 'fp-saas-01', 4, 'Billing Integration', 'Stripe integration for subscriptions, invoices, and usage-based pricing.', 'Working billing system with Stripe checkout and webhook handling', 'in_progress', 3, 0, 10.00, 5.00, 3, 75, NULL,
   datetime('now', '-5 days'), NULL, datetime('now', '-5 days')),

  ('ph-saas-05', 'fp-saas-01', 5, 'Deployment & CI/CD', 'Set up Vercel deployment, GitHub Actions, and monitoring.', 'Production-ready deployment pipeline with monitoring', 'pending', 3, 0, 5.00, NULL, 4, 30, NULL,
   NULL, NULL, datetime('now', '-5 days'));

-- ============================================================================
-- PHASES — Mobile App (4 phases)
-- ============================================================================

INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, estimated_minutes, actual_minutes, started_at, completed_at, created_at) VALUES
  ('ph-mob-01', 'fp-mobile-01', 1, 'Offline Storage Layer', 'Implement SQLite-based offline storage with sync queue.', 'Reliable offline-first data layer', 'completed', 4, 4, 10.00, 7.50, 0, 60, 48,
   datetime('now', '-21 days'), datetime('now', '-18 days'), datetime('now', '-21 days')),

  ('ph-mob-02', 'fp-mobile-01', 2, 'Push Notifications', 'Set up FCM/APNs, notification handlers, and deep linking.', 'Cross-platform push notification system', 'completed', 4, 4, 8.00, 6.25, 1, 45, 40,
   datetime('now', '-17 days'), datetime('now', '-14 days'), datetime('now', '-17 days')),

  ('ph-mob-03', 'fp-mobile-01', 3, 'Task Views', 'Build Kanban board, calendar view, and search/filter.', 'Rich task management views with drag-and-drop', 'in_progress', 3, 0, 12.00, 3.00, 2, 90, NULL,
   datetime('now', '-10 days'), NULL, datetime('now', '-10 days')),

  ('ph-mob-04', 'fp-mobile-01', 4, 'Performance & Polish', 'Optimize bundle size, animations, and accessibility.', 'Ship-ready quality bar with smooth 60fps interactions', 'pending', 3, 0, 5.00, NULL, 3, 45, NULL,
   NULL, NULL, datetime('now', '-10 days'));

-- ============================================================================
-- PHASES — API Gateway (3 phases)
-- ============================================================================

INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, estimated_minutes, actual_minutes, started_at, completed_at, created_at) VALUES
  ('ph-api-01', 'fp-api-01', 1, 'Core Routing', 'Implement request routing, middleware chain, and config loading.', 'Working request routing with middleware pipeline', 'completed', 4, 4, 10.00, 5.20, 0, 45, 35,
   datetime('now', '-7 days'), datetime('now', '-5 days'), datetime('now', '-7 days')),

  ('ph-api-02', 'fp-api-01', 2, 'Auth & Rate Limiting', 'JWT validation, API key auth, and per-client rate limiting.', 'Secure gateway with token validation and throttling', 'in_progress', 3, 0, 8.00, 2.00, 1, 60, NULL,
   datetime('now', '-4 days'), NULL, datetime('now', '-4 days')),

  ('ph-api-03', 'fp-api-01', 3, 'Observability', 'Structured logging, metrics, tracing, and health checks.', 'Full observability stack for production monitoring', 'pending', 3, 0, 7.00, NULL, 2, 45, NULL,
   NULL, NULL, datetime('now', '-4 days'));

-- ============================================================================
-- TASKS — SaaS Dashboard
-- ============================================================================

-- Phase 1: Scaffolding (completed)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, files_created, files_modified, order_index, started_at, completed_at, created_at) VALUES
  ('t-s1-01', 'ph-saas-01', '1.1', 'Initialize Next.js project', 'Create Next.js 14 app with TypeScript, Tailwind CSS, and ESLint config.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 'package.json,tsconfig.json,tailwind.config.ts', NULL, 0, datetime('now', '-14 days'), datetime('now', '-14 days', '+2 hours'), datetime('now', '-14 days')),
  ('t-s1-02', 'ph-saas-01', '1.2', 'Set up Prisma schema', 'Define database schema with User, Team, Subscription models.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 'prisma/schema.prisma', NULL, 1, datetime('now', '-14 days', '+2 hours'), datetime('now', '-14 days', '+4 hours'), datetime('now', '-14 days')),
  ('t-s1-03', 'ph-saas-01', '1.3', 'Implement NextAuth', 'Set up NextAuth with Google and GitHub OAuth providers.', 'completed', 'pilot', 'claude-opus-4-6', 'src/auth.ts,src/middleware.ts', 'next.config.ts', 2, datetime('now', '-13 days'), datetime('now', '-13 days', '+3 hours'), datetime('now', '-14 days')),
  ('t-s1-04', 'ph-saas-01', '1.4', 'Create base layout', 'Build app shell with sidebar navigation, header, and content area.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 'src/components/layout/sidebar.tsx,src/components/layout/header.tsx', NULL, 3, datetime('now', '-13 days', '+3 hours'), datetime('now', '-13 days', '+6 hours'), datetime('now', '-14 days'));

-- Phase 2: Dashboard Core (completed)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, files_created, files_modified, order_index, started_at, completed_at, created_at) VALUES
  ('t-s2-01', 'ph-saas-02', '2.1', 'Build chart components', 'Create reusable chart wrappers for line, bar, and pie charts using Recharts.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 'src/components/charts/line-chart.tsx,src/components/charts/bar-chart.tsx', NULL, 0, datetime('now', '-12 days'), datetime('now', '-12 days', '+3 hours'), datetime('now', '-12 days')),
  ('t-s2-02', 'ph-saas-02', '2.2', 'Implement data fetching', 'Set up TanStack Query with API routes for analytics data.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 'src/hooks/use-analytics.ts,src/app/api/analytics/route.ts', NULL, 1, datetime('now', '-11 days'), datetime('now', '-11 days', '+4 hours'), datetime('now', '-12 days')),
  ('t-s2-03', 'ph-saas-02', '2.3', 'Build dashboard page', 'Compose main dashboard with metric cards, charts, and recent activity.', 'completed', 'pilot', 'claude-opus-4-6', 'src/app/dashboard/page.tsx', 'src/components/layout/sidebar.tsx', 2, datetime('now', '-11 days', '+4 hours'), datetime('now', '-10 days', '+2 hours'), datetime('now', '-12 days')),
  ('t-s2-04', 'ph-saas-02', '2.4', 'Add real-time updates', 'Implement WebSocket connection for live metric updates.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 'src/hooks/use-realtime.ts,src/lib/websocket.ts', NULL, 3, datetime('now', '-10 days', '+2 hours'), datetime('now', '-10 days', '+5 hours'), datetime('now', '-12 days'));

-- Phase 3: User Management (completed)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, files_created, files_modified, order_index, started_at, completed_at, created_at) VALUES
  ('t-s3-01', 'ph-saas-03', '3.1', 'Build user CRUD API', 'REST endpoints for user creation, update, deactivation, and listing.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 'src/app/api/users/route.ts,src/app/api/users/[id]/route.ts', NULL, 0, datetime('now', '-9 days'), datetime('now', '-9 days', '+3 hours'), datetime('now', '-9 days')),
  ('t-s3-02', 'ph-saas-03', '3.2', 'Implement RBAC', 'Role-based access control with admin, editor, and viewer roles.', 'completed', 'pilot', 'claude-opus-4-6', 'src/lib/rbac.ts,src/middleware/auth-guard.ts', 'src/middleware.ts', 1, datetime('now', '-8 days'), datetime('now', '-8 days', '+4 hours'), datetime('now', '-9 days')),
  ('t-s3-03', 'ph-saas-03', '3.3', 'Build team invitation flow', 'Email-based invitation system with accept/decline workflow.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 'src/app/api/invitations/route.ts,src/emails/invitation.tsx', NULL, 2, datetime('now', '-8 days', '+4 hours'), datetime('now', '-7 days', '+2 hours'), datetime('now', '-9 days')),
  ('t-s3-04', 'ph-saas-03', '3.4', 'Create settings pages', 'User profile, team settings, and notification preferences UI.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 'src/app/settings/page.tsx,src/app/settings/team/page.tsx', NULL, 3, datetime('now', '-7 days', '+2 hours'), datetime('now', '-7 days', '+6 hours'), datetime('now', '-9 days'));

-- Phase 4: Billing (in_progress)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, created_at) VALUES
  ('t-s4-01', 'ph-saas-04', '4.1', 'Stripe checkout integration', 'Implement subscription checkout with pricing table and payment form.', 'in_progress', 'pilot', 'claude-opus-4-6', 0, datetime('now', '-5 days'), datetime('now', '-5 days')),
  ('t-s4-02', 'ph-saas-04', '4.2', 'Webhook handler', 'Process Stripe webhook events for subscription lifecycle.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, NULL, datetime('now', '-5 days')),
  ('t-s4-03', 'ph-saas-04', '4.3', 'Usage tracking', 'Implement metered billing with usage event recording.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, NULL, datetime('now', '-5 days'));

-- Phase 5: Deployment (pending)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, created_at) VALUES
  ('t-s5-01', 'ph-saas-05', '5.1', 'Vercel deployment config', 'Configure Vercel project with environment variables and preview deployments.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-5 days')),
  ('t-s5-02', 'ph-saas-05', '5.2', 'GitHub Actions CI', 'Set up CI pipeline with lint, type check, test, and deploy steps.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-5 days')),
  ('t-s5-03', 'ph-saas-05', '5.3', 'Monitoring setup', 'Configure Sentry error tracking and Vercel Analytics.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-5 days'));

-- ============================================================================
-- TASKS — Mobile App
-- ============================================================================

-- Phase 1: Offline Storage (completed)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-m1-01', 'ph-mob-01', '1.1', 'Set up WatermelonDB', 'Configure WatermelonDB with SQLite adapter and migration system.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-21 days'), datetime('now', '-20 days'), datetime('now', '-21 days')),
  ('t-m1-02', 'ph-mob-01', '1.2', 'Define data models', 'Create Task, Project, Tag, and Sync models with relations.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-20 days'), datetime('now', '-19 days'), datetime('now', '-21 days')),
  ('t-m1-03', 'ph-mob-01', '1.3', 'Build sync engine', 'Implement bidirectional sync with conflict resolution.', 'completed', 'pilot', 'claude-opus-4-6', 2, datetime('now', '-19 days'), datetime('now', '-18 days'), datetime('now', '-21 days')),
  ('t-m1-04', 'ph-mob-01', '1.4', 'Sync queue & retry', 'Background queue for failed sync operations with exponential backoff.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 3, datetime('now', '-18 days'), datetime('now', '-18 days', '+4 hours'), datetime('now', '-21 days'));

-- Phase 2: Push Notifications (completed)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-m2-01', 'ph-mob-02', '2.1', 'FCM/APNs setup', 'Configure Firebase Cloud Messaging and Apple Push Notification Service.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-17 days'), datetime('now', '-16 days'), datetime('now', '-17 days')),
  ('t-m2-02', 'ph-mob-02', '2.2', 'Notification handlers', 'Handle foreground, background, and killed-state notifications.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-16 days'), datetime('now', '-15 days'), datetime('now', '-17 days')),
  ('t-m2-03', 'ph-mob-02', '2.3', 'Deep linking', 'Map notification payloads to in-app navigation routes.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-15 days'), datetime('now', '-14 days'), datetime('now', '-17 days')),
  ('t-m2-04', 'ph-mob-02', '2.4', 'Notification preferences', 'User-configurable notification categories and quiet hours.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 3, datetime('now', '-14 days'), datetime('now', '-14 days', '+3 hours'), datetime('now', '-17 days'));

-- Phase 3: Task Views (in_progress)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, created_at) VALUES
  ('t-m3-01', 'ph-mob-03', '3.1', 'Kanban board', 'Drag-and-drop Kanban board with column customization.', 'in_progress', 'pilot', 'claude-opus-4-6', 0, datetime('now', '-10 days'), datetime('now', '-10 days')),
  ('t-m3-02', 'ph-mob-03', '3.2', 'Calendar view', 'Monthly/weekly calendar with task due dates and reminders.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, NULL, datetime('now', '-10 days')),
  ('t-m3-03', 'ph-mob-03', '3.3', 'Search & filters', 'Full-text search with date, tag, and status filters.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, NULL, datetime('now', '-10 days'));

-- Phase 4: Performance (pending)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, created_at) VALUES
  ('t-m4-01', 'ph-mob-04', '4.1', 'Bundle analysis & splitting', 'Analyze and optimize JS bundle with code splitting.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-10 days')),
  ('t-m4-02', 'ph-mob-04', '4.2', 'Animation optimization', 'Move animations to native driver, optimize FlatList rendering.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-10 days')),
  ('t-m4-03', 'ph-mob-04', '4.3', 'Accessibility audit', 'VoiceOver/TalkBack testing and ARIA label implementation.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-10 days'));

-- ============================================================================
-- TASKS — API Gateway
-- ============================================================================

-- Phase 1: Core Routing (completed)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-a1-01', 'ph-api-01', '1.1', 'Router implementation', 'Build trie-based HTTP router with path parameters and wildcards.', 'completed', 'pilot', 'claude-opus-4-6', 0, datetime('now', '-7 days'), datetime('now', '-6 days'), datetime('now', '-7 days')),
  ('t-a1-02', 'ph-api-01', '1.2', 'Middleware pipeline', 'Composable middleware chain with async/await support.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-6 days'), datetime('now', '-6 days', '+4 hours'), datetime('now', '-7 days')),
  ('t-a1-03', 'ph-api-01', '1.3', 'Config loader', 'YAML/TOML config with environment variable interpolation.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-6 days', '+4 hours'), datetime('now', '-5 days'), datetime('now', '-7 days')),
  ('t-a1-04', 'ph-api-01', '1.4', 'Request/response transforms', 'Header manipulation, body rewriting, and path rewriting.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 3, datetime('now', '-5 days'), datetime('now', '-5 days', '+3 hours'), datetime('now', '-7 days'));

-- Phase 2: Auth & Rate Limiting (in_progress)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, created_at) VALUES
  ('t-a2-01', 'ph-api-02', '2.1', 'JWT validation middleware', 'Validate JWT tokens with configurable issuers and audiences.', 'in_progress', 'pilot', 'claude-opus-4-6', 0, datetime('now', '-4 days'), datetime('now', '-4 days')),
  ('t-a2-02', 'ph-api-02', '2.2', 'API key authentication', 'API key validation with per-key rate limits and scopes.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, NULL, datetime('now', '-4 days')),
  ('t-a2-03', 'ph-api-02', '2.3', 'Rate limiter', 'Token bucket rate limiter with Redis backend and sliding windows.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, NULL, datetime('now', '-4 days'));

-- Phase 3: Observability (pending)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, created_at) VALUES
  ('t-a3-01', 'ph-api-03', '3.1', 'Structured logging', 'JSON logging with request correlation IDs and log levels.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-4 days')),
  ('t-a3-02', 'ph-api-03', '3.2', 'Prometheus metrics', 'Expose request count, latency histograms, and error rates.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-4 days')),
  ('t-a3-03', 'ph-api-03', '3.3', 'Health check endpoints', 'Liveness and readiness probes with dependency checks.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-4 days'));

-- ============================================================================
-- EXECUTIONS
-- ============================================================================

-- SaaS Dashboard executions
INSERT OR IGNORE INTO executions (id, project_id, session_number, phase_current, phase_total, task_current, task_total, status, cost_total, started_at, completed_at, created_at) VALUES
  ('exec-saas-01', 'proj-saas-dashboard-01', 1, '3', 5, '12', 18, 'completed', 18.50,
   datetime('now', '-14 days'), datetime('now', '-7 days'), datetime('now', '-14 days')),
  ('exec-saas-02', 'proj-saas-dashboard-01', 2, '4', 5, '13', 18, 'running', 14.00,
   datetime('now', '-5 days'), NULL, datetime('now', '-5 days')),
  ('exec-saas-03', 'proj-saas-dashboard-01', 3, '2', 5, '8', 18, 'paused', 8.20,
   datetime('now', '-3 days'), NULL, datetime('now', '-3 days'));

-- Mobile App executions
INSERT OR IGNORE INTO executions (id, project_id, session_number, phase_current, phase_total, task_current, task_total, status, cost_total, started_at, completed_at, created_at) VALUES
  ('exec-mob-01', 'proj-mobile-app-02', 1, '2', 4, '8', 14, 'completed', 13.75,
   datetime('now', '-21 days'), datetime('now', '-14 days'), datetime('now', '-21 days')),
  ('exec-mob-02', 'proj-mobile-app-02', 2, '3', 4, '9', 14, 'running', 5.00,
   datetime('now', '-10 days'), NULL, datetime('now', '-10 days'));

-- API Gateway executions
INSERT OR IGNORE INTO executions (id, project_id, session_number, phase_current, phase_total, task_current, task_total, status, cost_total, started_at, completed_at, created_at) VALUES
  ('exec-api-01', 'proj-api-gateway-03', 1, '1', 3, '4', 10, 'completed', 5.20,
   datetime('now', '-7 days'), datetime('now', '-5 days'), datetime('now', '-7 days')),
  ('exec-api-02', 'proj-api-gateway-03', 2, '2', 3, '5', 10, 'running', 3.00,
   datetime('now', '-4 days'), NULL, datetime('now', '-4 days'));

-- ============================================================================
-- COSTS
-- ============================================================================

-- SaaS Dashboard costs
INSERT OR IGNORE INTO costs (id, project_id, execution_id, phase, task, agent, model, input_tokens, output_tokens, total_cost, created_at) VALUES
  ('cost-s-01', 'proj-saas-dashboard-01', 'exec-saas-01', 'Project Scaffolding', 'Initialize Next.js project', 'pilot', 'claude-sonnet-4-5-20250929', 45000, 12000, 1.20, datetime('now', '-14 days')),
  ('cost-s-02', 'proj-saas-dashboard-01', 'exec-saas-01', 'Project Scaffolding', 'Set up Prisma schema', 'pilot', 'claude-sonnet-4-5-20250929', 38000, 15000, 1.40, datetime('now', '-14 days', '+2 hours')),
  ('cost-s-03', 'proj-saas-dashboard-01', 'exec-saas-01', 'Project Scaffolding', 'Implement NextAuth', 'pilot', 'claude-opus-4-6', 52000, 18000, 2.10, datetime('now', '-13 days')),
  ('cost-s-04', 'proj-saas-dashboard-01', 'exec-saas-01', 'Project Scaffolding', 'Create base layout', 'pilot', 'claude-sonnet-4-5-20250929', 35000, 11000, 1.50, datetime('now', '-13 days', '+3 hours')),
  ('cost-s-05', 'proj-saas-dashboard-01', 'exec-saas-01', 'Dashboard Core', 'Build chart components', 'pilot', 'claude-sonnet-4-5-20250929', 42000, 16000, 1.80, datetime('now', '-12 days')),
  ('cost-s-06', 'proj-saas-dashboard-01', 'exec-saas-01', 'Dashboard Core', 'Implement data fetching', 'pilot', 'claude-sonnet-4-5-20250929', 48000, 14000, 1.60, datetime('now', '-11 days')),
  ('cost-s-07', 'proj-saas-dashboard-01', 'exec-saas-01', 'Dashboard Core', 'Build dashboard page', 'pilot', 'claude-opus-4-6', 65000, 22000, 3.20, datetime('now', '-11 days', '+4 hours')),
  ('cost-s-08', 'proj-saas-dashboard-01', 'exec-saas-01', 'Dashboard Core', 'Add real-time updates', 'pilot', 'claude-sonnet-4-5-20250929', 30000, 9000, 1.90, datetime('now', '-10 days', '+2 hours')),
  ('cost-s-09', 'proj-saas-dashboard-01', 'exec-saas-01', 'User Management', 'Build user CRUD API', 'pilot', 'claude-sonnet-4-5-20250929', 40000, 13000, 1.50, datetime('now', '-9 days')),
  ('cost-s-10', 'proj-saas-dashboard-01', 'exec-saas-01', 'User Management', 'Implement RBAC', 'pilot', 'claude-opus-4-6', 55000, 19000, 2.80, datetime('now', '-8 days')),
  ('cost-s-11', 'proj-saas-dashboard-01', 'exec-saas-02', 'User Management', 'Team invitation flow', 'pilot', 'claude-sonnet-4-5-20250929', 35000, 10000, 1.30, datetime('now', '-8 days', '+4 hours')),
  ('cost-s-12', 'proj-saas-dashboard-01', 'exec-saas-02', 'User Management', 'Create settings pages', 'pilot', 'claude-sonnet-4-5-20250929', 28000, 8000, 1.20, datetime('now', '-7 days', '+2 hours')),
  ('cost-s-13', 'proj-saas-dashboard-01', 'exec-saas-02', 'Billing Integration', 'Stripe checkout integration', 'pilot', 'claude-opus-4-6', 72000, 25000, 5.00, datetime('now', '-5 days'));

-- Mobile App costs
INSERT OR IGNORE INTO costs (id, project_id, execution_id, phase, task, agent, model, input_tokens, output_tokens, total_cost, created_at) VALUES
  ('cost-m-01', 'proj-mobile-app-02', 'exec-mob-01', 'Offline Storage Layer', 'Set up WatermelonDB', 'pilot', 'claude-sonnet-4-5-20250929', 40000, 12000, 1.50, datetime('now', '-21 days')),
  ('cost-m-02', 'proj-mobile-app-02', 'exec-mob-01', 'Offline Storage Layer', 'Define data models', 'pilot', 'claude-sonnet-4-5-20250929', 35000, 10000, 1.30, datetime('now', '-20 days')),
  ('cost-m-03', 'proj-mobile-app-02', 'exec-mob-01', 'Offline Storage Layer', 'Build sync engine', 'pilot', 'claude-opus-4-6', 68000, 24000, 3.20, datetime('now', '-19 days')),
  ('cost-m-04', 'proj-mobile-app-02', 'exec-mob-01', 'Offline Storage Layer', 'Sync queue & retry', 'pilot', 'claude-sonnet-4-5-20250929', 30000, 9000, 1.50, datetime('now', '-18 days')),
  ('cost-m-05', 'proj-mobile-app-02', 'exec-mob-01', 'Push Notifications', 'FCM/APNs setup', 'pilot', 'claude-sonnet-4-5-20250929', 25000, 8000, 1.25, datetime('now', '-17 days')),
  ('cost-m-06', 'proj-mobile-app-02', 'exec-mob-01', 'Push Notifications', 'Notification handlers', 'pilot', 'claude-sonnet-4-5-20250929', 32000, 11000, 1.50, datetime('now', '-16 days')),
  ('cost-m-07', 'proj-mobile-app-02', 'exec-mob-01', 'Push Notifications', 'Deep linking', 'pilot', 'claude-sonnet-4-5-20250929', 28000, 9000, 1.50, datetime('now', '-15 days')),
  ('cost-m-08', 'proj-mobile-app-02', 'exec-mob-01', 'Push Notifications', 'Notification preferences', 'pilot', 'claude-sonnet-4-5-20250929', 22000, 7000, 1.00, datetime('now', '-14 days')),
  ('cost-m-09', 'proj-mobile-app-02', 'exec-mob-02', 'Task Views', 'Kanban board', 'pilot', 'claude-opus-4-6', 60000, 20000, 3.00, datetime('now', '-10 days'));

-- API Gateway costs
INSERT OR IGNORE INTO costs (id, project_id, execution_id, phase, task, agent, model, input_tokens, output_tokens, total_cost, created_at) VALUES
  ('cost-a-01', 'proj-api-gateway-03', 'exec-api-01', 'Core Routing', 'Router implementation', 'pilot', 'claude-opus-4-6', 55000, 18000, 2.00, datetime('now', '-7 days')),
  ('cost-a-02', 'proj-api-gateway-03', 'exec-api-01', 'Core Routing', 'Middleware pipeline', 'pilot', 'claude-sonnet-4-5-20250929', 32000, 10000, 1.20, datetime('now', '-6 days')),
  ('cost-a-03', 'proj-api-gateway-03', 'exec-api-01', 'Core Routing', 'Config loader', 'pilot', 'claude-sonnet-4-5-20250929', 25000, 8000, 1.00, datetime('now', '-6 days', '+4 hours')),
  ('cost-a-04', 'proj-api-gateway-03', 'exec-api-01', 'Core Routing', 'Request/response transforms', 'pilot', 'claude-sonnet-4-5-20250929', 28000, 9000, 1.00, datetime('now', '-5 days')),
  ('cost-a-05', 'proj-api-gateway-03', 'exec-api-02', 'Auth & Rate Limiting', 'JWT validation middleware', 'pilot', 'claude-opus-4-6', 48000, 15000, 2.00, datetime('now', '-4 days'));

-- ============================================================================
-- ACTIVITY LOG
-- ============================================================================

-- SaaS Dashboard activity (20 entries)
INSERT OR IGNORE INTO activity_log (id, project_id, execution_id, event_type, message, created_at) VALUES
  ('act-s-01', 'proj-saas-dashboard-01', 'exec-saas-01', 'execution_started', 'Execution #1 started — v1.0 Launch Plan', datetime('now', '-14 days')),
  ('act-s-02', 'proj-saas-dashboard-01', 'exec-saas-01', 'phase_started', 'Phase 1: Project Scaffolding started', datetime('now', '-14 days')),
  ('act-s-03', 'proj-saas-dashboard-01', 'exec-saas-01', 'task_completed', 'Completed: Initialize Next.js project (pilot)', datetime('now', '-14 days', '+2 hours')),
  ('act-s-04', 'proj-saas-dashboard-01', 'exec-saas-01', 'task_completed', 'Completed: Set up Prisma schema (pilot)', datetime('now', '-14 days', '+4 hours')),
  ('act-s-05', 'proj-saas-dashboard-01', 'exec-saas-01', 'task_completed', 'Completed: Implement NextAuth (pilot)', datetime('now', '-13 days', '+3 hours')),
  ('act-s-06', 'proj-saas-dashboard-01', 'exec-saas-01', 'phase_completed', 'Phase 1: Project Scaffolding completed — $6.20', datetime('now', '-13 days', '+6 hours')),
  ('act-s-07', 'proj-saas-dashboard-01', 'exec-saas-01', 'phase_started', 'Phase 2: Dashboard Core started', datetime('now', '-12 days')),
  ('act-s-08', 'proj-saas-dashboard-01', 'exec-saas-01', 'task_completed', 'Completed: Build chart components (pilot)', datetime('now', '-12 days', '+3 hours')),
  ('act-s-09', 'proj-saas-dashboard-01', 'exec-saas-01', 'task_completed', 'Completed: Build dashboard page (pilot)', datetime('now', '-10 days', '+2 hours')),
  ('act-s-10', 'proj-saas-dashboard-01', 'exec-saas-01', 'phase_completed', 'Phase 2: Dashboard Core completed — $8.50', datetime('now', '-10 days', '+5 hours')),
  ('act-s-11', 'proj-saas-dashboard-01', 'exec-saas-01', 'phase_started', 'Phase 3: User Management started', datetime('now', '-9 days')),
  ('act-s-12', 'proj-saas-dashboard-01', 'exec-saas-01', 'decision_made', 'Chose role-based access control over attribute-based for MVP scope', datetime('now', '-8 days')),
  ('act-s-13', 'proj-saas-dashboard-01', 'exec-saas-01', 'task_completed', 'Completed: Implement RBAC (pilot)', datetime('now', '-8 days', '+4 hours')),
  ('act-s-14', 'proj-saas-dashboard-01', 'exec-saas-01', 'phase_completed', 'Phase 3: User Management completed — $9.80', datetime('now', '-7 days', '+6 hours')),
  ('act-s-15', 'proj-saas-dashboard-01', 'exec-saas-01', 'execution_completed', 'Execution #1 completed — $18.50 total', datetime('now', '-7 days')),
  ('act-s-16', 'proj-saas-dashboard-01', 'exec-saas-02', 'execution_started', 'Execution #2 started — continuing billing phase', datetime('now', '-5 days')),
  ('act-s-17', 'proj-saas-dashboard-01', 'exec-saas-02', 'phase_started', 'Phase 4: Billing Integration started', datetime('now', '-5 days')),
  ('act-s-18', 'proj-saas-dashboard-01', 'exec-saas-02', 'task_started', 'Started: Stripe checkout integration (pilot)', datetime('now', '-5 days')),
  ('act-s-19', 'proj-saas-dashboard-01', 'exec-saas-02', 'decision_made', 'Using Stripe Checkout Sessions over custom payment forms for faster MVP', datetime('now', '-4 days')),
  ('act-s-20', 'proj-saas-dashboard-01', 'exec-saas-03', 'execution_paused', 'Execution #3 paused — waiting for Stripe API key configuration', datetime('now', '-3 days'));

-- Mobile App activity (15 entries)
INSERT OR IGNORE INTO activity_log (id, project_id, execution_id, event_type, message, created_at) VALUES
  ('act-m-01', 'proj-mobile-app-02', 'exec-mob-01', 'execution_started', 'Execution #1 started — v2.0 Feature Release', datetime('now', '-21 days')),
  ('act-m-02', 'proj-mobile-app-02', 'exec-mob-01', 'phase_started', 'Phase 1: Offline Storage Layer started', datetime('now', '-21 days')),
  ('act-m-03', 'proj-mobile-app-02', 'exec-mob-01', 'task_completed', 'Completed: Set up WatermelonDB (pilot)', datetime('now', '-20 days')),
  ('act-m-04', 'proj-mobile-app-02', 'exec-mob-01', 'task_completed', 'Completed: Build sync engine (pilot)', datetime('now', '-18 days')),
  ('act-m-05', 'proj-mobile-app-02', 'exec-mob-01', 'phase_completed', 'Phase 1: Offline Storage Layer completed — $7.50', datetime('now', '-18 days', '+4 hours')),
  ('act-m-06', 'proj-mobile-app-02', 'exec-mob-01', 'phase_started', 'Phase 2: Push Notifications started', datetime('now', '-17 days')),
  ('act-m-07', 'proj-mobile-app-02', 'exec-mob-01', 'decision_made', 'Chose React Native Firebase over Notifee for simpler FCM integration', datetime('now', '-17 days')),
  ('act-m-08', 'proj-mobile-app-02', 'exec-mob-01', 'task_completed', 'Completed: FCM/APNs setup (pilot)', datetime('now', '-16 days')),
  ('act-m-09', 'proj-mobile-app-02', 'exec-mob-01', 'task_completed', 'Completed: Deep linking (pilot)', datetime('now', '-14 days')),
  ('act-m-10', 'proj-mobile-app-02', 'exec-mob-01', 'phase_completed', 'Phase 2: Push Notifications completed — $6.25', datetime('now', '-14 days', '+3 hours')),
  ('act-m-11', 'proj-mobile-app-02', 'exec-mob-01', 'execution_completed', 'Execution #1 completed — $13.75 total', datetime('now', '-14 days')),
  ('act-m-12', 'proj-mobile-app-02', 'exec-mob-02', 'execution_started', 'Execution #2 started — Task Views phase', datetime('now', '-10 days')),
  ('act-m-13', 'proj-mobile-app-02', 'exec-mob-02', 'phase_started', 'Phase 3: Task Views started', datetime('now', '-10 days')),
  ('act-m-14', 'proj-mobile-app-02', 'exec-mob-02', 'task_started', 'Started: Kanban board (pilot)', datetime('now', '-10 days')),
  ('act-m-15', 'proj-mobile-app-02', 'exec-mob-02', 'decision_made', 'Using react-native-reanimated for drag-and-drop over PanResponder', datetime('now', '-9 days'));

-- API Gateway activity (15 entries)
INSERT OR IGNORE INTO activity_log (id, project_id, execution_id, event_type, message, created_at) VALUES
  ('act-a-01', 'proj-api-gateway-03', 'exec-api-01', 'execution_started', 'Execution #1 started — Initial Build', datetime('now', '-7 days')),
  ('act-a-02', 'proj-api-gateway-03', 'exec-api-01', 'phase_started', 'Phase 1: Core Routing started', datetime('now', '-7 days')),
  ('act-a-03', 'proj-api-gateway-03', 'exec-api-01', 'task_completed', 'Completed: Router implementation (pilot)', datetime('now', '-6 days')),
  ('act-a-04', 'proj-api-gateway-03', 'exec-api-01', 'task_completed', 'Completed: Middleware pipeline (pilot)', datetime('now', '-6 days', '+4 hours')),
  ('act-a-05', 'proj-api-gateway-03', 'exec-api-01', 'decision_made', 'Chose YAML over TOML for gateway config — better ecosystem support', datetime('now', '-6 days')),
  ('act-a-06', 'proj-api-gateway-03', 'exec-api-01', 'task_completed', 'Completed: Config loader (pilot)', datetime('now', '-5 days')),
  ('act-a-07', 'proj-api-gateway-03', 'exec-api-01', 'task_completed', 'Completed: Request/response transforms (pilot)', datetime('now', '-5 days', '+3 hours')),
  ('act-a-08', 'proj-api-gateway-03', 'exec-api-01', 'phase_completed', 'Phase 1: Core Routing completed — $5.20', datetime('now', '-5 days', '+3 hours')),
  ('act-a-09', 'proj-api-gateway-03', 'exec-api-01', 'execution_completed', 'Execution #1 completed — $5.20 total', datetime('now', '-5 days')),
  ('act-a-10', 'proj-api-gateway-03', 'exec-api-02', 'execution_started', 'Execution #2 started — Auth & Rate Limiting phase', datetime('now', '-4 days')),
  ('act-a-11', 'proj-api-gateway-03', 'exec-api-02', 'phase_started', 'Phase 2: Auth & Rate Limiting started', datetime('now', '-4 days')),
  ('act-a-12', 'proj-api-gateway-03', 'exec-api-02', 'task_started', 'Started: JWT validation middleware (pilot)', datetime('now', '-4 days')),
  ('act-a-13', 'proj-api-gateway-03', 'exec-api-02', 'decision_made', 'Using jsonwebtoken crate with RS256 algorithm for JWT validation', datetime('now', '-3 days')),
  ('act-a-14', 'proj-api-gateway-03', 'exec-api-02', 'decision_made', 'Token bucket over sliding window for rate limiting — lower memory footprint', datetime('now', '-2 days')),
  ('act-a-15', 'proj-api-gateway-03', 'exec-api-02', 'checkpoint_created', 'Checkpoint: Auth middleware at 60% — context usage 45%', datetime('now', '-1 days'));

-- ============================================================================
-- DECISIONS
-- ============================================================================

-- SaaS Dashboard decisions
INSERT OR IGNORE INTO decisions (id, project_id, execution_id, phase, category, question, answer, reasoning, tags, impact_status, created_at) VALUES
  ('dec-s-01', 'proj-saas-dashboard-01', 'exec-saas-01', 'Project Scaffolding', 'architecture', 'Which ORM to use?', 'Prisma', 'Type-safe queries, excellent migration system, and strong Next.js integration.', '["database","orm","typescript"]', 'active', datetime('now', '-14 days')),
  ('dec-s-02', 'proj-saas-dashboard-01', 'exec-saas-01', 'Project Scaffolding', 'architecture', 'Authentication approach?', 'NextAuth with OAuth providers', 'Battle-tested library with built-in Google/GitHub OAuth, session management, and CSRF protection.', '["auth","security","oauth"]', 'active', datetime('now', '-13 days')),
  ('dec-s-03', 'proj-saas-dashboard-01', 'exec-saas-01', 'User Management', 'design', 'RBAC vs ABAC for access control?', 'RBAC with three roles: admin, editor, viewer', 'Simpler to implement and reason about for MVP. Can evolve to ABAC later if needed.', '["security","access-control"]', 'active', datetime('now', '-8 days')),
  ('dec-s-04', 'proj-saas-dashboard-01', 'exec-saas-02', 'Billing Integration', 'technology', 'Custom payment forms or Stripe Checkout?', 'Stripe Checkout Sessions', 'Faster to implement, PCI-compliant by default, handles 3D Secure automatically.', '["billing","stripe","payments"]', 'active', datetime('now', '-4 days')),
  ('dec-s-05', 'proj-saas-dashboard-01', 'exec-saas-02', 'Dashboard Core', 'technology', 'Chart library selection?', 'Recharts', 'React-first API, good TypeScript support, responsive by default. Lighter than D3 for our use case.', '["frontend","charts","visualization"]', 'active', datetime('now', '-12 days'));

-- Mobile App decisions
INSERT OR IGNORE INTO decisions (id, project_id, execution_id, phase, category, question, answer, reasoning, tags, impact_status, created_at) VALUES
  ('dec-m-01', 'proj-mobile-app-02', 'exec-mob-01', 'Offline Storage Layer', 'architecture', 'Offline database choice?', 'WatermelonDB with SQLite', 'Lazy loading, excellent React Native integration, built-in sync primitives.', '["database","offline","mobile"]', 'active', datetime('now', '-21 days')),
  ('dec-m-02', 'proj-mobile-app-02', 'exec-mob-01', 'Offline Storage Layer', 'design', 'Sync conflict resolution strategy?', 'Last-write-wins with server authority', 'Simplest strategy that works for task management. Field-level merge too complex for MVP.', '["sync","conflict-resolution"]', 'active', datetime('now', '-19 days')),
  ('dec-m-03', 'proj-mobile-app-02', 'exec-mob-01', 'Push Notifications', 'technology', 'Notification library?', 'React Native Firebase', 'Unified API for FCM and APNs, good community support, handles background messages.', '["notifications","firebase"]', 'active', datetime('now', '-17 days')),
  ('dec-m-04', 'proj-mobile-app-02', 'exec-mob-02', 'Task Views', 'technology', 'Drag-and-drop library?', 'react-native-reanimated + gesture-handler', 'Native-thread animations for 60fps drag, works with FlatList for large lists.', '["ui","animation","gesture"]', 'active', datetime('now', '-9 days'));

-- API Gateway decisions
INSERT OR IGNORE INTO decisions (id, project_id, execution_id, phase, category, question, answer, reasoning, tags, impact_status, created_at) VALUES
  ('dec-a-01', 'proj-api-gateway-03', 'exec-api-01', 'Core Routing', 'architecture', 'Router data structure?', 'Trie-based routing', 'O(k) lookup where k is path segment count. Supports wildcards and path params naturally.', '["performance","routing"]', 'active', datetime('now', '-7 days')),
  ('dec-a-02', 'proj-api-gateway-03', 'exec-api-01', 'Core Routing', 'technology', 'Config file format?', 'YAML', 'Better ecosystem support, human-readable, widespread in gateway/proxy tools (Nginx, Kong, Envoy).', '["config","devex"]', 'active', datetime('now', '-6 days')),
  ('dec-a-03', 'proj-api-gateway-03', 'exec-api-02', 'Auth & Rate Limiting', 'technology', 'JWT algorithm?', 'RS256', 'Asymmetric keys allow gateway to validate without shared secrets. Standard in microservice architectures.', '["security","jwt","auth"]', 'active', datetime('now', '-3 days')),
  ('dec-a-04', 'proj-api-gateway-03', 'exec-api-02', 'Auth & Rate Limiting', 'architecture', 'Rate limiting algorithm?', 'Token bucket with Redis', 'Lower memory than sliding window, configurable burst. Redis backend for distributed operation.', '["performance","security","rate-limiting"]', 'active', datetime('now', '-2 days'));

-- ============================================================================
-- TEST RUNS
-- ============================================================================

-- SaaS Dashboard test runs
INSERT OR IGNORE INTO test_runs (id, project_id, execution_id, phase, total_tests, passed, failed, skipped, duration_ms, coverage_lines, coverage_branches, coverage_functions, started_at, completed_at, created_at) VALUES
  ('tr-s-01', 'proj-saas-dashboard-01', 'exec-saas-01', 'Dashboard Core', 42, 40, 1, 1, 8500, 78.5, 65.2, 82.0,
   datetime('now', '-10 days'), datetime('now', '-10 days', '+8 seconds'), datetime('now', '-10 days')),
  ('tr-s-02', 'proj-saas-dashboard-01', 'exec-saas-02', 'User Management', 56, 55, 0, 1, 12300, 85.3, 72.1, 88.5,
   datetime('now', '-7 days'), datetime('now', '-7 days', '+12 seconds'), datetime('now', '-7 days'));

-- Mobile App test runs
INSERT OR IGNORE INTO test_runs (id, project_id, execution_id, phase, total_tests, passed, failed, skipped, duration_ms, coverage_lines, coverage_branches, coverage_functions, started_at, completed_at, created_at) VALUES
  ('tr-m-01', 'proj-mobile-app-02', 'exec-mob-01', 'Offline Storage Layer', 38, 36, 2, 0, 6200, 72.0, 58.4, 76.3,
   datetime('now', '-18 days'), datetime('now', '-18 days', '+6 seconds'), datetime('now', '-18 days')),
  ('tr-m-02', 'proj-mobile-app-02', 'exec-mob-01', 'Push Notifications', 24, 24, 0, 0, 4100, 81.2, 68.0, 84.5,
   datetime('now', '-14 days'), datetime('now', '-14 days', '+4 seconds'), datetime('now', '-14 days'));

-- API Gateway test runs
INSERT OR IGNORE INTO test_runs (id, project_id, execution_id, phase, total_tests, passed, failed, skipped, duration_ms, coverage_lines, coverage_branches, coverage_functions, started_at, completed_at, created_at) VALUES
  ('tr-a-01', 'proj-api-gateway-03', 'exec-api-01', 'Core Routing', 65, 63, 1, 1, 3200, 88.7, 76.3, 91.2,
   datetime('now', '-5 days'), datetime('now', '-5 days', '+3 seconds'), datetime('now', '-5 days')),
  ('tr-a-02', 'proj-api-gateway-03', 'exec-api-02', 'Auth & Rate Limiting', 28, 26, 2, 0, 2100, 74.5, 60.1, 79.8,
   datetime('now', '-3 days'), datetime('now', '-3 days', '+2 seconds'), datetime('now', '-3 days'));

-- ============================================================================
-- KNOWLEDGE
-- ============================================================================

-- SaaS Dashboard knowledge (10 entries)
INSERT OR IGNORE INTO knowledge (id, project_id, title, content, category, source, metadata, created_at) VALUES
  ('kn-s-01', 'proj-saas-dashboard-01', 'Prisma connection pooling',
   'Use PrismaClient singleton pattern with connection pooling for serverless. Max connections should be set to 10 for Vercel. Use `global.prisma` pattern in development to survive HMR. In production, PrismaClient automatically manages the pool.',
   'learning', 'Phase 1: Project Scaffolding', '{"tags":["database","prisma","serverless"]}', datetime('now', '-14 days')),

  ('kn-s-02', 'proj-saas-dashboard-01', 'NextAuth session strategy',
   'JWT strategy works better for serverless — no database session lookups needed. Set maxAge to 30 days. Use `getServerSession()` in API routes and `useSession()` in client components. Custom session callback to include user role.',
   'decision', 'Phase 1: Project Scaffolding', '{"tags":["auth","nextauth","jwt"]}', datetime('now', '-13 days')),

  ('kn-s-03', 'proj-saas-dashboard-01', 'Stripe webhook idempotency',
   'Always check event.type and use idempotency keys. Store processed event IDs to prevent duplicate handling. Use `stripe.webhooks.constructEvent()` to verify signatures. Never trust client-side payment confirmations.',
   'reference', 'Phase 4: Billing Integration', '{"tags":["stripe","billing","webhooks"]}', datetime('now', '-5 days')),

  ('kn-s-04', 'proj-saas-dashboard-01', 'Tailwind CSS dark mode configuration',
   'Using class-based dark mode strategy with next-themes. Define CSS variables in globals.css for brand colors. Use `dark:` prefix for theme-specific styles. HSL color format for easy alpha manipulation.',
   'reference', 'Phase 1: Project Scaffolding', '{"tags":["css","tailwind","theming"]}', datetime('now', '-14 days', '+3 hours')),

  ('kn-s-05', 'proj-saas-dashboard-01', 'TanStack Query cache invalidation patterns',
   'Use queryKey factories for consistent cache keys. Invalidate related queries after mutations using `queryClient.invalidateQueries()`. Set staleTime to 5 minutes for dashboard data, 30 seconds for real-time metrics. Prefetch on hover for navigation.',
   'learning', 'Phase 2: Dashboard Core', '{"tags":["react-query","caching","data-fetching"]}', datetime('now', '-11 days')),

  ('kn-s-06', 'proj-saas-dashboard-01', 'Recharts responsive container pattern',
   'Wrap all charts in ResponsiveContainer with 100% width and fixed height. Use custom tick formatters for date axes. Memoize chart data transformations to prevent re-renders. Export chart data as CSV using custom utility.',
   'learning', 'Phase 2: Dashboard Core', '{"tags":["charts","recharts","performance"]}', datetime('now', '-12 days')),

  ('kn-s-07', 'proj-saas-dashboard-01', 'RBAC middleware implementation',
   'Three-tier role system: admin > editor > viewer. Middleware checks session.user.role against route requirements. API routes use withAuth(handler, requiredRole) wrapper. Admin can manage team, editor can modify content, viewer is read-only.',
   'decision', 'Phase 3: User Management', '{"tags":["security","rbac","authorization"]}', datetime('now', '-8 days')),

  ('kn-s-08', 'proj-saas-dashboard-01', 'Email template with React Email',
   'Using React Email for transactional emails (invitations, notifications). Templates in src/emails/ directory. Render to HTML with render() function. Send via Resend API. Preview templates at localhost:3001 during development.',
   'reference', 'Phase 3: User Management', '{"tags":["email","react-email","resend"]}', datetime('now', '-8 days', '+4 hours')),

  ('kn-s-09', 'proj-saas-dashboard-01', 'WebSocket reconnection strategy',
   'Implement exponential backoff for WebSocket reconnection: 1s, 2s, 4s, 8s, max 30s. Use heartbeat pings every 30 seconds. Show reconnection indicator in UI. Buffer messages during disconnection and replay on reconnect.',
   'learning', 'Phase 2: Dashboard Core', '{"tags":["websocket","real-time","resilience"]}', datetime('now', '-10 days')),

  ('kn-s-10', 'proj-saas-dashboard-01', 'Vercel deployment environment variables',
   'Use Vercel CLI for env management: `vercel env pull .env.local`. Separate env groups for Preview, Production, Development. DATABASE_URL uses connection pooler URL in production, direct URL for migrations. Never commit .env files.',
   'fact', 'Phase 5: Deployment', '{"tags":["vercel","deployment","environment"]}', datetime('now', '-5 days', '+2 hours')),

-- Mobile App knowledge (8 entries)
  ('kn-m-01', 'proj-mobile-app-02', 'WatermelonDB migration gotcha',
   'Migrations must be additive only. Cannot remove columns in production. Use schemaMigrations() with version bumps. Test migrations on a copy of production data before release. Keep migration code forever — it runs on every app update.',
   'learning', 'Phase 1: Offline Storage', '{"tags":["database","watermelondb","migrations"]}', datetime('now', '-20 days')),

  ('kn-m-02', 'proj-mobile-app-02', 'iOS push notification entitlements',
   'Must enable Push Notifications capability in Xcode AND create APNs key in Apple Developer Console. Sandbox vs Production environments require different endpoints. Test on physical device — simulator does not support push.',
   'fact', 'Phase 2: Push Notifications', '{"tags":["ios","push-notifications","xcode"]}', datetime('now', '-17 days')),

  ('kn-m-03', 'proj-mobile-app-02', 'React Native bridge performance',
   'Minimize bridge crossings — batch operations where possible. Use `InteractionManager.runAfterInteractions()` for heavy operations. The new architecture (Fabric + TurboModules) reduces bridge overhead significantly. Profile with Flipper.',
   'learning', 'Phase 1: Offline Storage', '{"tags":["react-native","performance","bridge"]}', datetime('now', '-19 days')),

  ('kn-m-04', 'proj-mobile-app-02', 'Offline-first sync conflict resolution',
   'Last-write-wins (LWW) strategy with server authority. Track `updated_at` timestamps in ISO 8601 format. When conflict detected: server version wins for shared data, local version preserved in conflict queue for user review. Sync queue uses FIFO with retry backoff.',
   'decision', 'Phase 1: Offline Storage', '{"tags":["sync","offline","conflict-resolution"]}', datetime('now', '-19 days', '+4 hours')),

  ('kn-m-05', 'proj-mobile-app-02', 'FCM token refresh handling',
   'Firebase Cloud Messaging tokens can change at any time. Listen to `messaging().onTokenRefresh()` and update server. Store token in AsyncStorage as backup. Handle token registration failure gracefully — retry on next app foreground.',
   'reference', 'Phase 2: Push Notifications', '{"tags":["firebase","fcm","tokens"]}', datetime('now', '-16 days')),

  ('kn-m-06', 'proj-mobile-app-02', 'Deep linking URL scheme',
   'Custom URL scheme: `taskapp://` for direct links. Universal links for iOS: apple-app-site-association file on web server. Android App Links: assetlinks.json with SHA256 fingerprint. Parse link params with React Navigation linking config.',
   'reference', 'Phase 2: Push Notifications', '{"tags":["deep-linking","navigation","urls"]}', datetime('now', '-15 days')),

  ('kn-m-07', 'proj-mobile-app-02', 'FlatList optimization techniques',
   'Use `getItemLayout` for fixed-height items to skip measurement. Set `maxToRenderPerBatch` to 10, `windowSize` to 5. Use `React.memo()` for list items. Implement `keyExtractor` with stable IDs. For large lists, consider FlashList from Shopify.',
   'learning', 'Phase 3: Task Views', '{"tags":["react-native","flatlist","performance"]}', datetime('now', '-10 days')),

  ('kn-m-08', 'proj-mobile-app-02', 'Reanimated worklet threading model',
   'Worklets run on the UI thread — avoid async operations inside them. Use `useSharedValue` for cross-thread data, `useAnimatedStyle` for animated props. `runOnJS` to call JavaScript functions from worklets. Shared values are not React state — do not trigger re-renders.',
   'learning', 'Phase 3: Task Views', '{"tags":["reanimated","animation","threading"]}', datetime('now', '-9 days')),

-- API Gateway knowledge (8 entries)
  ('kn-a-01', 'proj-api-gateway-03', 'Axum state sharing',
   'Use Extension layer for shared state (connection pools, config). Arc<T> for thread-safe sharing across handlers. For mutable state, Arc<Mutex<T>> or Arc<RwLock<T>>. Prefer RwLock when reads vastly outnumber writes (like config).',
   'learning', 'Phase 1: Core Routing', '{"tags":["axum","rust","state-management"]}', datetime('now', '-6 days')),

  ('kn-a-02', 'proj-api-gateway-03', 'JWT RS256 key rotation',
   'Support JWKS endpoint for key rotation. Cache public keys with TTL of 1 hour. Fallback to re-fetch on validation failure with max 1 re-fetch per minute to prevent amplification attacks. Use `jsonwebtoken` crate with `DecodingKey::from_rsa_pem`.',
   'reference', 'Phase 2: Auth & Rate Limiting', '{"tags":["jwt","security","key-rotation"]}', datetime('now', '-3 days')),

  ('kn-a-03', 'proj-api-gateway-03', 'Trie router benchmarks',
   'Custom trie router benchmarks: 2.3M req/s for static routes, 1.8M req/s with path parameters, 1.5M req/s with wildcards. Measured on M2 Pro with criterion.rs. Outperforms regex-based routing by 4x for complex route tables.',
   'fact', 'Phase 1: Core Routing', '{"tags":["performance","benchmarks","routing"]}', datetime('now', '-6 days', '+2 hours')),

  ('kn-a-04', 'proj-api-gateway-03', 'YAML config hot-reload pattern',
   'Watch config file with notify crate. On change: parse new config, validate against schema, swap Arc<Config> atomically. Existing connections continue with old config, new connections use updated config. Emit reload event for metrics.',
   'learning', 'Phase 1: Core Routing', '{"tags":["config","hot-reload","yaml"]}', datetime('now', '-5 days', '+1 hour')),

  ('kn-a-05', 'proj-api-gateway-03', 'Token bucket rate limiter design',
   'Each bucket: capacity (burst size), refill rate (requests/second), current tokens. Check: if tokens >= 1, decrement and allow; otherwise reject with 429. Redis backend: use Lua script for atomic check-and-decrement. Per-client identification via API key or IP.',
   'decision', 'Phase 2: Auth & Rate Limiting', '{"tags":["rate-limiting","redis","algorithm"]}', datetime('now', '-2 days')),

  ('kn-a-06', 'proj-api-gateway-03', 'Graceful shutdown with Tokio',
   'Use `tokio::signal::ctrl_c()` combined with a shutdown broadcast channel. On signal: stop accepting new connections, wait for in-flight requests (with timeout), flush metrics, close database pools. Implement `Drop` for cleanup of OS resources.',
   'reference', 'Phase 1: Core Routing', '{"tags":["tokio","shutdown","lifecycle"]}', datetime('now', '-5 days', '+4 hours')),

  ('kn-a-07', 'proj-api-gateway-03', 'Request body size limits',
   'Default max body size: 1MB for JSON, 10MB for file uploads. Configurable per-route in gateway YAML. Enforce at middleware layer before deserialization. Return 413 Payload Too Large with clear error message. Stream large uploads to avoid memory spikes.',
   'fact', 'Phase 1: Core Routing', '{"tags":["security","limits","request-body"]}', datetime('now', '-5 days', '+2 hours')),

  ('kn-a-08', 'proj-api-gateway-03', 'Structured logging with tracing crate',
   'Use `tracing` crate with `tracing-subscriber` for structured JSON logging. Add spans for request lifecycle: accept -> route -> middleware -> handler -> response. Include correlation_id, method, path, status, duration_ms in every log line. Use `tracing::instrument` macro on handlers.',
   'reference', 'Phase 3: Observability', '{"tags":["logging","tracing","observability"]}', datetime('now', '-2 days', '+3 hours'));

-- ============================================================================
-- KNOWLEDGE BOOKMARKS
-- ============================================================================

INSERT OR IGNORE INTO knowledge_bookmarks (id, project_id, file_path, heading, heading_level, note, created_at) VALUES
  ('kb-s-01', 'proj-saas-dashboard-01', 'docs/architecture.md', 'Authentication Flow', 2, 'Key reference for OAuth provider setup', datetime('now', '-12 days')),
  ('kb-s-02', 'proj-saas-dashboard-01', 'docs/api.md', 'Rate Limiting', 2, 'Important for billing integration', datetime('now', '-8 days')),
  ('kb-s-03', 'proj-saas-dashboard-01', 'README.md', 'Environment Variables', 2, NULL, datetime('now', '-14 days')),
  ('kb-m-01', 'proj-mobile-app-02', 'docs/sync-protocol.md', 'Conflict Resolution', 2, 'Core sync algorithm details', datetime('now', '-19 days')),
  ('kb-m-02', 'proj-mobile-app-02', 'docs/push-notifications.md', 'Platform Setup', 2, 'FCM and APNs configuration steps', datetime('now', '-16 days')),
  ('kb-a-01', 'proj-api-gateway-03', 'docs/routing.md', 'Trie Implementation', 2, 'Performance-critical path', datetime('now', '-6 days')),
  ('kb-a-02', 'proj-api-gateway-03', 'docs/middleware.md', 'Middleware Chain', 2, 'Execution order matters', datetime('now', '-5 days'));

-- ============================================================================
-- EXECUTION BOOKMARKS
-- ============================================================================

INSERT OR IGNORE INTO execution_bookmarks (id, project_id, execution_id, label, line_number, bookmark_type, context, created_at) VALUES
  ('eb-s-01', 'proj-saas-dashboard-01', 'exec-saas-01', 'Auth middleware working', 245, 'milestone', 'NextAuth middleware passing all test cases', datetime('now', '-13 days')),
  ('eb-s-02', 'proj-saas-dashboard-01', 'exec-saas-01', 'Dashboard charts rendering', 512, 'milestone', 'All 4 chart types rendering with live data', datetime('now', '-10 days')),
  ('eb-s-03', 'proj-saas-dashboard-01', 'exec-saas-02', 'Stripe key missing', 89, 'error', 'STRIPE_SECRET_KEY not set in environment', datetime('now', '-3 days')),
  ('eb-s-04', 'proj-saas-dashboard-01', 'exec-saas-02', 'RBAC tests passing', 380, 'milestone', 'All 3 roles validated with correct permissions', datetime('now', '-7 days')),
  ('eb-m-01', 'proj-mobile-app-02', 'exec-mob-01', 'Sync engine first run', 156, 'milestone', 'Bidirectional sync completing without errors', datetime('now', '-18 days')),
  ('eb-m-02', 'proj-mobile-app-02', 'exec-mob-01', 'Push notification received', 310, 'milestone', 'First FCM message received on device', datetime('now', '-16 days')),
  ('eb-m-03', 'proj-mobile-app-02', 'exec-mob-02', 'FlatList render error', 42, 'error', 'Key extractor returning undefined for new items', datetime('now', '-9 days')),
  ('eb-a-01', 'proj-api-gateway-03', 'exec-api-01', 'Router benchmark complete', 198, 'milestone', '2.3M req/s on static routes', datetime('now', '-6 days')),
  ('eb-a-02', 'proj-api-gateway-03', 'exec-api-02', 'JWT validation error', 67, 'error', 'RS256 key format mismatch — needed PEM not DER', datetime('now', '-3 days'));

-- ============================================================================
-- TEST RESULTS (individual test cases)
-- ============================================================================

-- SaaS Dashboard test results (test run tr-s-01: Dashboard Core)
INSERT OR IGNORE INTO test_results (id, test_run_id, test_name, test_file, status, duration_ms, error_message) VALUES
  ('tres-s01-01', 'tr-s-01', 'renders line chart with data', 'src/components/charts/line-chart.test.tsx', 'passed', 120, NULL),
  ('tres-s01-02', 'tr-s-01', 'renders bar chart with categories', 'src/components/charts/bar-chart.test.tsx', 'passed', 95, NULL),
  ('tres-s01-03', 'tr-s-01', 'handles empty dataset gracefully', 'src/components/charts/line-chart.test.tsx', 'passed', 45, NULL),
  ('tres-s01-04', 'tr-s-01', 'fetches analytics data on mount', 'src/hooks/use-analytics.test.ts', 'passed', 230, NULL),
  ('tres-s01-05', 'tr-s-01', 'caches analytics response', 'src/hooks/use-analytics.test.ts', 'passed', 180, NULL),
  ('tres-s01-06', 'tr-s-01', 'dashboard renders metric cards', 'src/app/dashboard/page.test.tsx', 'passed', 310, NULL),
  ('tres-s01-07', 'tr-s-01', 'dashboard shows loading skeleton', 'src/app/dashboard/page.test.tsx', 'passed', 85, NULL),
  ('tres-s01-08', 'tr-s-01', 'websocket connects on mount', 'src/hooks/use-realtime.test.ts', 'passed', 420, NULL),
  ('tres-s01-09', 'tr-s-01', 'websocket reconnects on close', 'src/hooks/use-realtime.test.ts', 'failed', 5200, 'Timeout: reconnection took longer than 5s'),
  ('tres-s01-10', 'tr-s-01', 'responsive chart resize', 'src/components/charts/responsive.test.tsx', 'skipped', 0, NULL);

-- SaaS Dashboard test results (test run tr-s-02: User Management)
INSERT OR IGNORE INTO test_results (id, test_run_id, test_name, test_file, status, duration_ms, error_message) VALUES
  ('tres-s02-01', 'tr-s-02', 'creates user with valid data', 'src/app/api/users/route.test.ts', 'passed', 150, NULL),
  ('tres-s02-02', 'tr-s-02', 'rejects duplicate email', 'src/app/api/users/route.test.ts', 'passed', 120, NULL),
  ('tres-s02-03', 'tr-s-02', 'admin can delete users', 'src/app/api/users/[id]/route.test.ts', 'passed', 95, NULL),
  ('tres-s02-04', 'tr-s-02', 'viewer cannot modify data', 'src/middleware/auth-guard.test.ts', 'passed', 80, NULL),
  ('tres-s02-05', 'tr-s-02', 'editor can update content', 'src/middleware/auth-guard.test.ts', 'passed', 75, NULL),
  ('tres-s02-06', 'tr-s-02', 'sends invitation email', 'src/app/api/invitations/route.test.ts', 'passed', 890, NULL),
  ('tres-s02-07', 'tr-s-02', 'invitation expires after 7 days', 'src/app/api/invitations/route.test.ts', 'passed', 110, NULL),
  ('tres-s02-08', 'tr-s-02', 'settings page renders tabs', 'src/app/settings/page.test.tsx', 'passed', 200, NULL),
  ('tres-s02-09', 'tr-s-02', 'team settings require admin', 'src/app/settings/team/page.test.tsx', 'passed', 130, NULL),
  ('tres-s02-10', 'tr-s-02', 'profile update saves changes', 'src/app/settings/page.test.tsx', 'skipped', 0, NULL);

-- Mobile App test results (test run tr-m-01: Offline Storage)
INSERT OR IGNORE INTO test_results (id, test_run_id, test_name, test_file, status, duration_ms, error_message) VALUES
  ('tres-m01-01', 'tr-m-01', 'creates task offline', 'src/models/task.test.ts', 'passed', 85, NULL),
  ('tres-m01-02', 'tr-m-01', 'syncs pending changes', 'src/sync/engine.test.ts', 'passed', 340, NULL),
  ('tres-m01-03', 'tr-m-01', 'resolves conflict with LWW', 'src/sync/conflict.test.ts', 'passed', 210, NULL),
  ('tres-m01-04', 'tr-m-01', 'retries failed sync', 'src/sync/queue.test.ts', 'passed', 520, NULL),
  ('tres-m01-05', 'tr-m-01', 'migration v1 to v2', 'src/models/migrations.test.ts', 'failed', 1200, 'Column tasks.priority not found after migration'),
  ('tres-m01-06', 'tr-m-01', 'migration v2 to v3', 'src/models/migrations.test.ts', 'failed', 800, 'Foreign key constraint violation on project_id');

-- API Gateway test results (test run tr-a-01: Core Routing)
INSERT OR IGNORE INTO test_results (id, test_run_id, test_name, test_file, status, duration_ms, error_message) VALUES
  ('tres-a01-01', 'tr-a-01', 'routes static path', 'tests/router.rs', 'passed', 12, NULL),
  ('tres-a01-02', 'tr-a-01', 'routes with path params', 'tests/router.rs', 'passed', 15, NULL),
  ('tres-a01-03', 'tr-a-01', 'routes wildcard paths', 'tests/router.rs', 'passed', 18, NULL),
  ('tres-a01-04', 'tr-a-01', 'middleware executes in order', 'tests/middleware.rs', 'passed', 25, NULL),
  ('tres-a01-05', 'tr-a-01', 'loads YAML config', 'tests/config.rs', 'passed', 8, NULL),
  ('tres-a01-06', 'tr-a-01', 'rewrites request headers', 'tests/transform.rs', 'passed', 20, NULL),
  ('tres-a01-07', 'tr-a-01', 'returns 404 for unknown routes', 'tests/router.rs', 'passed', 10, NULL),
  ('tres-a01-08', 'tr-a-01', 'handles malformed request', 'tests/router.rs', 'failed', 45, 'Panic on empty path segment — needs bounds check'),
  ('tres-a01-09', 'tr-a-01', 'config hot-reload', 'tests/config.rs', 'skipped', 0, NULL);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

INSERT OR IGNORE INTO notifications (id, project_id, notification_type, title, message, link, read, created_at) VALUES
  ('notif-01', 'proj-saas-dashboard-01', 'execution_completed', 'Execution #1 Completed', 'SaaS Dashboard execution finished — $18.50 total cost', '/project/proj-saas-dashboard-01', 1, datetime('now', '-7 days')),
  ('notif-02', 'proj-saas-dashboard-01', 'test_failure', 'Test Failure Detected', 'WebSocket reconnection test timed out in Dashboard Core', '/project/proj-saas-dashboard-01', 1, datetime('now', '-10 days')),
  ('notif-03', 'proj-saas-dashboard-01', 'execution_paused', 'Execution #3 Paused', 'Waiting for Stripe API key configuration', '/project/proj-saas-dashboard-01', 0, datetime('now', '-3 days')),
  ('notif-04', 'proj-mobile-app-02', 'execution_completed', 'Execution #1 Completed', 'Mobile App v2.0 phases 1-2 finished — $13.75', '/project/proj-mobile-app-02', 1, datetime('now', '-14 days')),
  ('notif-05', 'proj-mobile-app-02', 'test_failure', 'Migration Tests Failed', '2 migration tests failed in Offline Storage phase', '/project/proj-mobile-app-02', 0, datetime('now', '-18 days')),
  ('notif-06', 'proj-api-gateway-03', 'phase_completed', 'Core Routing Complete', 'Phase 1 finished — all 4 tasks completed', '/project/proj-api-gateway-03', 1, datetime('now', '-5 days')),
  ('notif-07', 'proj-api-gateway-03', 'cost_warning', 'Cost Approaching Threshold', 'API Gateway execution at $3.00 of $5.00 warn threshold', '/project/proj-api-gateway-03', 0, datetime('now', '-2 days'));

-- ============================================================================
-- CHECKPOINTS
-- ============================================================================

INSERT OR IGNORE INTO checkpoints (id, project_id, execution_id, state, phase, task, context_usage_pct, name, created_at) VALUES
  ('cp-s-01', 'proj-saas-dashboard-01', 'exec-saas-01', 'running', 'Project Scaffolding', 'Implement NextAuth', 35.2, 'Auth setup midpoint', datetime('now', '-13 days')),
  ('cp-s-02', 'proj-saas-dashboard-01', 'exec-saas-01', 'running', 'Dashboard Core', 'Build dashboard page', 62.8, 'Dashboard layout complete', datetime('now', '-11 days')),
  ('cp-s-03', 'proj-saas-dashboard-01', 'exec-saas-01', 'running', 'User Management', 'Implement RBAC', 78.5, 'RBAC middleware done', datetime('now', '-8 days')),
  ('cp-s-04', 'proj-saas-dashboard-01', 'exec-saas-02', 'running', 'Billing Integration', 'Stripe checkout integration', 45.0, 'Stripe session created', datetime('now', '-4 days')),
  ('cp-m-01', 'proj-mobile-app-02', 'exec-mob-01', 'running', 'Offline Storage Layer', 'Build sync engine', 52.3, 'Sync protocol defined', datetime('now', '-19 days')),
  ('cp-m-02', 'proj-mobile-app-02', 'exec-mob-01', 'running', 'Push Notifications', 'Deep linking', 71.0, 'URL scheme configured', datetime('now', '-15 days')),
  ('cp-m-03', 'proj-mobile-app-02', 'exec-mob-02', 'running', 'Task Views', 'Kanban board', 38.5, 'Drag-and-drop prototype', datetime('now', '-8 days')),
  ('cp-a-01', 'proj-api-gateway-03', 'exec-api-01', 'running', 'Core Routing', 'Middleware pipeline', 40.1, 'Middleware chain working', datetime('now', '-6 days')),
  ('cp-a-02', 'proj-api-gateway-03', 'exec-api-02', 'running', 'Auth & Rate Limiting', 'JWT validation middleware', 45.0, 'JWT decode working', datetime('now', '-3 days'));

-- ============================================================================
-- COST THRESHOLDS
-- ============================================================================

INSERT OR IGNORE INTO cost_thresholds (id, project_id, warn_cost, alert_cost, stop_cost, enabled) VALUES
  ('ct-01', 'proj-saas-dashboard-01', 15.00, 35.00, 60.00, 1),
  ('ct-02', 'proj-mobile-app-02', 12.00, 30.00, 50.00, 1),
  ('ct-03', 'proj-api-gateway-03', 5.00, 15.00, 30.00, 1);

-- ============================================================================
-- SETTINGS (default theme and preferences)
-- ============================================================================

INSERT OR REPLACE INTO settings (key, value) VALUES
  ('theme', '"dark"'),
  ('sidebar_collapsed', 'false'),
  ('notifications_enabled', 'true'),
  ('terminal_font_size', '13');
