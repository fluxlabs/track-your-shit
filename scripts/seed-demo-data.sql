-- Track Your Shit - Demo Data Seed Script
-- Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
--
-- Usage: sqlite3 "$DB_PATH" < scripts/seed-demo-data.sql
-- Seeds the database with realistic demo data for screenshots.

-- ============================================================================
-- CREATE NOTIFICATIONS TABLE (not in schema migrations yet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- PROJECTS (5 projects: 3 GSD, 1 bare active, 1 archived)
-- ============================================================================

INSERT OR IGNORE INTO projects (id, name, path, description, tech_stack, config, status, is_favorite, created_at, updated_at) VALUES
  ('proj-saas-dashboard-01', 'SaaS Dashboard', '/Users/demo/projects/saas-dashboard',
   'Full-stack analytics dashboard with real-time metrics, user management, and billing integration. Built for a multi-tenant B2B platform.',
   '{"framework":"Next.js","language":"TypeScript","package_manager":"pnpm","database":"PostgreSQL","test_framework":"Vitest","has_planning":true,"gsd_phase_count":5,"gsd_todo_count":3,"gsd_has_requirements":true}',
   '{"model_profile":"quality","workflow_mode":"autonomous"}',
   'active', 1,
   datetime('now', '-14 days'), datetime('now', '-1 hour')),

  ('proj-mobile-app-02', 'TaskFlow Mobile', '/Users/demo/projects/taskflow-mobile',
   'Cross-platform mobile app for task management with offline sync, push notifications, and team collaboration.',
   '{"framework":"React Native","language":"TypeScript","package_manager":"yarn","database":"SQLite","test_framework":"Jest","has_planning":true,"gsd_phase_count":4,"gsd_todo_count":5,"gsd_has_requirements":true}',
   '{"model_profile":"balanced"}',
   'active', 1,
   datetime('now', '-21 days'), datetime('now', '-3 hours')),

  ('proj-api-gateway-03', 'API Gateway', '/Users/demo/projects/api-gateway',
   'High-performance API gateway with rate limiting, JWT auth, and request transformation. Handles 2M+ requests/sec.',
   '{"framework":"Axum","language":"Rust","package_manager":"cargo","database":null,"test_framework":"cargo test","has_planning":true,"gsd_phase_count":3,"gsd_todo_count":2,"gsd_has_requirements":false}',
   '{}',
   'active', 0,
   datetime('now', '-7 days'), datetime('now', '-6 hours')),

  ('proj-blog-engine-04', 'Personal Blog', '/Users/demo/projects/blog-engine',
   'Static site generator with markdown support, RSS feeds, and automatic OG image generation.',
   '{"framework":"Astro","language":"TypeScript","package_manager":"npm","database":null,"test_framework":"Vitest","has_planning":false,"gsd_phase_count":null,"gsd_todo_count":null,"gsd_has_requirements":false}',
   '{}',
   'active', 0,
   datetime('now', '-30 days'), datetime('now', '-2 days')),

  ('proj-cli-tool-05', 'DevSync CLI', '/Users/demo/projects/devsync-cli',
   'Developer productivity CLI for syncing dotfiles, managing dev environments, and automating setup scripts.',
   '{"framework":null,"language":"Rust","package_manager":"cargo","database":null,"test_framework":"cargo test","has_planning":true,"gsd_phase_count":2,"gsd_todo_count":1,"gsd_has_requirements":true}',
   '{}',
   'archived', 0,
   datetime('now', '-45 days'), datetime('now', '-15 days'));

-- ============================================================================
-- ROADMAPS
-- ============================================================================

INSERT OR IGNORE INTO roadmaps (id, project_id, name, description, total_phases, completed_phases, total_tasks, completed_tasks, estimated_cost, actual_cost, status, created_at, updated_at) VALUES
  ('rm-saas-01', 'proj-saas-dashboard-01', 'v1.0 Launch Plan',
   'Full implementation plan for SaaS Dashboard MVP including auth, analytics, billing, and deployment.',
   5, 3, 18, 12, 45.00, 32.50, 'in_progress',
   datetime('now', '-14 days'), datetime('now', '-1 hour')),

  ('rm-mobile-01', 'proj-mobile-app-02', 'v2.0 Feature Release',
   'Major feature release adding offline sync, push notifications, and new task views.',
   4, 2, 14, 8, 35.00, 18.75, 'in_progress',
   datetime('now', '-21 days'), datetime('now', '-3 hours')),

  ('rm-api-01', 'proj-api-gateway-03', 'Initial Build',
   'Core gateway implementation with routing, auth middleware, and rate limiting.',
   3, 1, 10, 4, 25.00, 8.20, 'in_progress',
   datetime('now', '-7 days'), datetime('now', '-6 hours')),

  ('rm-cli-01', 'proj-cli-tool-05', 'v1.0 Release',
   'Core CLI with dotfile sync and environment management.',
   2, 2, 6, 6, 12.00, 9.50, 'completed',
   datetime('now', '-45 days'), datetime('now', '-15 days'));

-- ============================================================================
-- PHASES — SaaS Dashboard (5 phases)
-- ============================================================================

INSERT OR IGNORE INTO phases (id, roadmap_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, estimated_minutes, actual_minutes, started_at, completed_at, created_at) VALUES
  ('ph-saas-01', 'rm-saas-01', 1, 'Project Scaffolding', 'Set up Next.js project with Prisma, auth, and base layout.', 'Establish project foundation with all core dependencies', 'completed', 4, 4, 8.00, 6.20, 0, 45, 38,
   datetime('now', '-14 days'), datetime('now', '-13 days'), datetime('now', '-14 days')),

  ('ph-saas-02', 'rm-saas-01', 2, 'Dashboard Core', 'Build the main dashboard layout with chart components and data fetching.', 'Deliver interactive analytics dashboard with real-time data', 'completed', 4, 4, 10.00, 8.50, 1, 60, 52,
   datetime('now', '-12 days'), datetime('now', '-10 days'), datetime('now', '-12 days')),

  ('ph-saas-03', 'rm-saas-01', 3, 'User Management', 'Implement user CRUD, roles, invitations, and team settings.', 'Complete user management system with RBAC', 'completed', 4, 4, 12.00, 9.80, 2, 90, 75,
   datetime('now', '-9 days'), datetime('now', '-7 days'), datetime('now', '-9 days')),

  ('ph-saas-04', 'rm-saas-01', 4, 'Billing Integration', 'Stripe integration for subscriptions, invoices, and usage-based pricing.', 'Working billing system with Stripe checkout and webhook handling', 'in_progress', 3, 0, 10.00, 5.00, 3, 75, NULL,
   datetime('now', '-5 days'), NULL, datetime('now', '-5 days')),

  ('ph-saas-05', 'rm-saas-01', 5, 'Deployment & CI/CD', 'Set up Vercel deployment, GitHub Actions, and monitoring.', 'Production-ready deployment pipeline with monitoring', 'pending', 3, 0, 5.00, NULL, 4, 30, NULL,
   NULL, NULL, datetime('now', '-5 days'));

-- ============================================================================
-- PHASES — Mobile App (4 phases)
-- ============================================================================

INSERT OR IGNORE INTO phases (id, roadmap_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, estimated_minutes, actual_minutes, started_at, completed_at, created_at) VALUES
  ('ph-mob-01', 'rm-mobile-01', 1, 'Offline Storage Layer', 'Implement SQLite-based offline storage with sync queue.', 'Reliable offline-first data layer', 'completed', 4, 4, 10.00, 7.50, 0, 60, 48,
   datetime('now', '-21 days'), datetime('now', '-18 days'), datetime('now', '-21 days')),

  ('ph-mob-02', 'rm-mobile-01', 2, 'Push Notifications', 'Set up FCM/APNs, notification handlers, and deep linking.', 'Cross-platform push notification system', 'completed', 4, 4, 8.00, 6.25, 1, 45, 40,
   datetime('now', '-17 days'), datetime('now', '-14 days'), datetime('now', '-17 days')),

  ('ph-mob-03', 'rm-mobile-01', 3, 'Task Views', 'Build Kanban board, calendar view, and search/filter.', 'Rich task management views with drag-and-drop', 'in_progress', 3, 0, 12.00, 3.00, 2, 90, NULL,
   datetime('now', '-10 days'), NULL, datetime('now', '-10 days')),

  ('ph-mob-04', 'rm-mobile-01', 4, 'Performance & Polish', 'Optimize bundle size, animations, and accessibility.', 'Ship-ready quality bar with smooth 60fps interactions', 'pending', 3, 0, 5.00, NULL, 3, 45, NULL,
   NULL, NULL, datetime('now', '-10 days'));

-- ============================================================================
-- PHASES — API Gateway (3 phases)
-- ============================================================================

INSERT OR IGNORE INTO phases (id, roadmap_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, estimated_minutes, actual_minutes, started_at, completed_at, created_at) VALUES
  ('ph-api-01', 'rm-api-01', 1, 'Core Routing', 'Implement request routing, middleware chain, and config loading.', 'Working request routing with middleware pipeline', 'completed', 4, 4, 10.00, 5.20, 0, 45, 35,
   datetime('now', '-7 days'), datetime('now', '-5 days'), datetime('now', '-7 days')),

  ('ph-api-02', 'rm-api-01', 2, 'Auth & Rate Limiting', 'JWT validation, API key auth, and per-client rate limiting.', 'Secure gateway with token validation and throttling', 'in_progress', 3, 0, 8.00, 2.00, 1, 60, NULL,
   datetime('now', '-4 days'), NULL, datetime('now', '-4 days')),

  ('ph-api-03', 'rm-api-01', 3, 'Observability', 'Structured logging, metrics, tracing, and health checks.', 'Full observability stack for production monitoring', 'pending', 3, 0, 7.00, NULL, 2, 45, NULL,
   NULL, NULL, datetime('now', '-4 days'));

-- ============================================================================
-- PHASES — CLI Tool (2 phases, completed)
-- ============================================================================

INSERT OR IGNORE INTO phases (id, roadmap_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, estimated_minutes, actual_minutes, started_at, completed_at, created_at) VALUES
  ('ph-cli-01', 'rm-cli-01', 1, 'Core CLI Framework', 'Set up clap-based CLI with config management.', 'Working CLI with subcommands and config', 'completed', 3, 3, 6.00, 4.50, 0, 30, 25,
   datetime('now', '-45 days'), datetime('now', '-40 days'), datetime('now', '-45 days')),

  ('ph-cli-02', 'rm-cli-01', 2, 'Dotfile Sync', 'Implement dotfile tracking, diff, and sync.', 'Reliable dotfile sync across machines', 'completed', 3, 3, 6.00, 5.00, 1, 35, 30,
   datetime('now', '-38 days'), datetime('now', '-35 days'), datetime('now', '-38 days'));

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

INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-m1-01', 'ph-mob-01', '1.1', 'Set up WatermelonDB', 'Configure WatermelonDB with SQLite adapter and migration system.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-21 days'), datetime('now', '-20 days'), datetime('now', '-21 days')),
  ('t-m1-02', 'ph-mob-01', '1.2', 'Define data models', 'Create Task, Project, Tag, and Sync models with relations.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-20 days'), datetime('now', '-19 days'), datetime('now', '-21 days')),
  ('t-m1-03', 'ph-mob-01', '1.3', 'Build sync engine', 'Implement bidirectional sync with conflict resolution.', 'completed', 'pilot', 'claude-opus-4-6', 2, datetime('now', '-19 days'), datetime('now', '-18 days'), datetime('now', '-21 days')),
  ('t-m1-04', 'ph-mob-01', '1.4', 'Sync queue & retry', 'Background queue for failed sync operations with exponential backoff.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 3, datetime('now', '-18 days'), datetime('now', '-18 days', '+4 hours'), datetime('now', '-21 days'));

INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-m2-01', 'ph-mob-02', '2.1', 'FCM/APNs setup', 'Configure Firebase Cloud Messaging and Apple Push Notification Service.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-17 days'), datetime('now', '-16 days'), datetime('now', '-17 days')),
  ('t-m2-02', 'ph-mob-02', '2.2', 'Notification handlers', 'Handle foreground, background, and killed-state notifications.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-16 days'), datetime('now', '-15 days'), datetime('now', '-17 days')),
  ('t-m2-03', 'ph-mob-02', '2.3', 'Deep linking', 'Map notification payloads to in-app navigation routes.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-15 days'), datetime('now', '-14 days'), datetime('now', '-17 days')),
  ('t-m2-04', 'ph-mob-02', '2.4', 'Notification preferences', 'User-configurable notification categories and quiet hours.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 3, datetime('now', '-14 days'), datetime('now', '-14 days', '+3 hours'), datetime('now', '-17 days'));

INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, created_at) VALUES
  ('t-m3-01', 'ph-mob-03', '3.1', 'Kanban board', 'Drag-and-drop Kanban board with column customization.', 'in_progress', 'pilot', 'claude-opus-4-6', 0, datetime('now', '-10 days'), datetime('now', '-10 days')),
  ('t-m3-02', 'ph-mob-03', '3.2', 'Calendar view', 'Monthly/weekly calendar with task due dates and reminders.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, NULL, datetime('now', '-10 days')),
  ('t-m3-03', 'ph-mob-03', '3.3', 'Search & filters', 'Full-text search with date, tag, and status filters.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, NULL, datetime('now', '-10 days'));

INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, created_at) VALUES
  ('t-m4-01', 'ph-mob-04', '4.1', 'Bundle analysis & splitting', 'Analyze and optimize JS bundle with code splitting.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-10 days')),
  ('t-m4-02', 'ph-mob-04', '4.2', 'Animation optimization', 'Move animations to native driver, optimize FlatList rendering.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-10 days')),
  ('t-m4-03', 'ph-mob-04', '4.3', 'Accessibility audit', 'VoiceOver/TalkBack testing and ARIA label implementation.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-10 days'));

-- ============================================================================
-- TASKS — API Gateway
-- ============================================================================

INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-a1-01', 'ph-api-01', '1.1', 'Router implementation', 'Build trie-based HTTP router with path parameters and wildcards.', 'completed', 'pilot', 'claude-opus-4-6', 0, datetime('now', '-7 days'), datetime('now', '-6 days'), datetime('now', '-7 days')),
  ('t-a1-02', 'ph-api-01', '1.2', 'Middleware pipeline', 'Composable middleware chain with async/await support.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-6 days'), datetime('now', '-6 days', '+4 hours'), datetime('now', '-7 days')),
  ('t-a1-03', 'ph-api-01', '1.3', 'Config loader', 'YAML/TOML config with environment variable interpolation.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-6 days', '+4 hours'), datetime('now', '-5 days'), datetime('now', '-7 days')),
  ('t-a1-04', 'ph-api-01', '1.4', 'Request/response transforms', 'Header manipulation, body rewriting, and path rewriting.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 3, datetime('now', '-5 days'), datetime('now', '-5 days', '+3 hours'), datetime('now', '-7 days'));

INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, created_at) VALUES
  ('t-a2-01', 'ph-api-02', '2.1', 'JWT validation middleware', 'Validate JWT tokens with configurable issuers and audiences.', 'in_progress', 'pilot', 'claude-opus-4-6', 0, datetime('now', '-4 days'), datetime('now', '-4 days')),
  ('t-a2-02', 'ph-api-02', '2.2', 'API key authentication', 'API key validation with per-key rate limits and scopes.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, NULL, datetime('now', '-4 days')),
  ('t-a2-03', 'ph-api-02', '2.3', 'Rate limiter', 'Token bucket rate limiter with Redis backend and sliding windows.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, NULL, datetime('now', '-4 days'));

INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, created_at) VALUES
  ('t-a3-01', 'ph-api-03', '3.1', 'Structured logging', 'JSON logging with request correlation IDs and log levels.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-4 days')),
  ('t-a3-02', 'ph-api-03', '3.2', 'Prometheus metrics', 'Expose request count, latency histograms, and error rates.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-4 days')),
  ('t-a3-03', 'ph-api-03', '3.3', 'Health check endpoints', 'Liveness and readiness probes with dependency checks.', 'pending', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-4 days'));

-- ============================================================================
-- TASKS — CLI Tool (completed)
-- ============================================================================

INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, description, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-c1-01', 'ph-cli-01', '1.1', 'CLI argument parsing', 'Set up clap with subcommands for sync, init, and status.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-45 days'), datetime('now', '-44 days'), datetime('now', '-45 days')),
  ('t-c1-02', 'ph-cli-01', '1.2', 'Config file management', 'TOML config with XDG directory support.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 1, datetime('now', '-43 days'), datetime('now', '-42 days'), datetime('now', '-45 days')),
  ('t-c1-03', 'ph-cli-01', '1.3', 'Error handling framework', 'Anyhow-based error chain with user-friendly messages.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-41 days'), datetime('now', '-40 days'), datetime('now', '-45 days')),
  ('t-c2-01', 'ph-cli-02', '2.1', 'Dotfile discovery', 'Scan home directory for dotfiles with ignore patterns.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 0, datetime('now', '-38 days'), datetime('now', '-37 days'), datetime('now', '-38 days')),
  ('t-c2-02', 'ph-cli-02', '2.2', 'Diff engine', 'Three-way diff for detecting local and remote changes.', 'completed', 'pilot', 'claude-opus-4-6', 1, datetime('now', '-37 days'), datetime('now', '-36 days'), datetime('now', '-38 days')),
  ('t-c2-03', 'ph-cli-02', '2.3', 'Sync command', 'Bidirectional sync with conflict prompts.', 'completed', 'pilot', 'claude-sonnet-4-5-20250929', 2, datetime('now', '-36 days'), datetime('now', '-35 days'), datetime('now', '-38 days'));

-- ============================================================================
-- COSTS
-- ============================================================================

INSERT OR IGNORE INTO costs (id, project_id, phase, task, agent, model, input_tokens, output_tokens, total_cost, created_at) VALUES
  ('cost-s-01', 'proj-saas-dashboard-01', 'Project Scaffolding', 'Initialize Next.js project', 'pilot', 'claude-sonnet-4-5-20250929', 45000, 12000, 1.20, datetime('now', '-14 days')),
  ('cost-s-02', 'proj-saas-dashboard-01', 'Project Scaffolding', 'Set up Prisma schema', 'pilot', 'claude-sonnet-4-5-20250929', 38000, 15000, 1.40, datetime('now', '-14 days', '+2 hours')),
  ('cost-s-03', 'proj-saas-dashboard-01', 'Project Scaffolding', 'Implement NextAuth', 'pilot', 'claude-opus-4-6', 52000, 18000, 2.10, datetime('now', '-13 days')),
  ('cost-s-04', 'proj-saas-dashboard-01', 'Project Scaffolding', 'Create base layout', 'pilot', 'claude-sonnet-4-5-20250929', 35000, 11000, 1.50, datetime('now', '-13 days', '+3 hours')),
  ('cost-s-05', 'proj-saas-dashboard-01', 'Dashboard Core', 'Build chart components', 'pilot', 'claude-sonnet-4-5-20250929', 42000, 16000, 1.80, datetime('now', '-12 days')),
  ('cost-s-06', 'proj-saas-dashboard-01', 'Dashboard Core', 'Implement data fetching', 'pilot', 'claude-sonnet-4-5-20250929', 48000, 14000, 1.60, datetime('now', '-11 days')),
  ('cost-s-07', 'proj-saas-dashboard-01', 'Dashboard Core', 'Build dashboard page', 'pilot', 'claude-opus-4-6', 65000, 22000, 3.20, datetime('now', '-11 days', '+4 hours')),
  ('cost-s-08', 'proj-saas-dashboard-01', 'Dashboard Core', 'Add real-time updates', 'pilot', 'claude-sonnet-4-5-20250929', 30000, 9000, 1.90, datetime('now', '-10 days', '+2 hours')),
  ('cost-s-09', 'proj-saas-dashboard-01', 'User Management', 'Build user CRUD API', 'pilot', 'claude-sonnet-4-5-20250929', 40000, 13000, 1.50, datetime('now', '-9 days')),
  ('cost-s-10', 'proj-saas-dashboard-01', 'User Management', 'Implement RBAC', 'pilot', 'claude-opus-4-6', 55000, 19000, 2.80, datetime('now', '-8 days')),
  ('cost-s-11', 'proj-saas-dashboard-01', 'User Management', 'Team invitation flow', 'pilot', 'claude-sonnet-4-5-20250929', 35000, 10000, 1.30, datetime('now', '-8 days', '+4 hours')),
  ('cost-s-12', 'proj-saas-dashboard-01', 'User Management', 'Create settings pages', 'pilot', 'claude-sonnet-4-5-20250929', 28000, 8000, 1.20, datetime('now', '-7 days', '+2 hours')),
  ('cost-s-13', 'proj-saas-dashboard-01', 'Billing Integration', 'Stripe checkout integration', 'pilot', 'claude-opus-4-6', 72000, 25000, 5.00, datetime('now', '-5 days'));

INSERT OR IGNORE INTO costs (id, project_id, phase, task, agent, model, input_tokens, output_tokens, total_cost, created_at) VALUES
  ('cost-m-01', 'proj-mobile-app-02', 'Offline Storage Layer', 'Set up WatermelonDB', 'pilot', 'claude-sonnet-4-5-20250929', 40000, 12000, 1.50, datetime('now', '-21 days')),
  ('cost-m-02', 'proj-mobile-app-02', 'Offline Storage Layer', 'Define data models', 'pilot', 'claude-sonnet-4-5-20250929', 35000, 10000, 1.30, datetime('now', '-20 days')),
  ('cost-m-03', 'proj-mobile-app-02', 'Offline Storage Layer', 'Build sync engine', 'pilot', 'claude-opus-4-6', 68000, 24000, 3.20, datetime('now', '-19 days')),
  ('cost-m-04', 'proj-mobile-app-02', 'Offline Storage Layer', 'Sync queue & retry', 'pilot', 'claude-sonnet-4-5-20250929', 30000, 9000, 1.50, datetime('now', '-18 days')),
  ('cost-m-05', 'proj-mobile-app-02', 'Push Notifications', 'FCM/APNs setup', 'pilot', 'claude-sonnet-4-5-20250929', 25000, 8000, 1.25, datetime('now', '-17 days')),
  ('cost-m-06', 'proj-mobile-app-02', 'Push Notifications', 'Notification handlers', 'pilot', 'claude-sonnet-4-5-20250929', 32000, 11000, 1.50, datetime('now', '-16 days')),
  ('cost-m-07', 'proj-mobile-app-02', 'Push Notifications', 'Deep linking', 'pilot', 'claude-sonnet-4-5-20250929', 28000, 9000, 1.50, datetime('now', '-15 days')),
  ('cost-m-08', 'proj-mobile-app-02', 'Push Notifications', 'Notification preferences', 'pilot', 'claude-sonnet-4-5-20250929', 22000, 7000, 1.00, datetime('now', '-14 days')),
  ('cost-m-09', 'proj-mobile-app-02', 'Task Views', 'Kanban board', 'pilot', 'claude-opus-4-6', 60000, 20000, 3.00, datetime('now', '-10 days'));

INSERT OR IGNORE INTO costs (id, project_id, phase, task, agent, model, input_tokens, output_tokens, total_cost, created_at) VALUES
  ('cost-a-01', 'proj-api-gateway-03', 'Core Routing', 'Router implementation', 'pilot', 'claude-opus-4-6', 55000, 18000, 2.00, datetime('now', '-7 days')),
  ('cost-a-02', 'proj-api-gateway-03', 'Core Routing', 'Middleware pipeline', 'pilot', 'claude-sonnet-4-5-20250929', 32000, 10000, 1.20, datetime('now', '-6 days')),
  ('cost-a-03', 'proj-api-gateway-03', 'Core Routing', 'Config loader', 'pilot', 'claude-sonnet-4-5-20250929', 25000, 8000, 1.00, datetime('now', '-6 days', '+4 hours')),
  ('cost-a-04', 'proj-api-gateway-03', 'Core Routing', 'Request/response transforms', 'pilot', 'claude-sonnet-4-5-20250929', 28000, 9000, 1.00, datetime('now', '-5 days')),
  ('cost-a-05', 'proj-api-gateway-03', 'Auth & Rate Limiting', 'JWT validation middleware', 'pilot', 'claude-opus-4-6', 48000, 15000, 2.00, datetime('now', '-4 days'));

INSERT OR IGNORE INTO costs (id, project_id, phase, task, agent, model, input_tokens, output_tokens, total_cost, created_at) VALUES
  ('cost-c-01', 'proj-cli-tool-05', 'Core CLI Framework', 'CLI argument parsing', 'pilot', 'claude-sonnet-4-5-20250929', 20000, 6000, 0.80, datetime('now', '-45 days')),
  ('cost-c-02', 'proj-cli-tool-05', 'Core CLI Framework', 'Config file management', 'pilot', 'claude-sonnet-4-5-20250929', 18000, 5000, 0.70, datetime('now', '-43 days')),
  ('cost-c-03', 'proj-cli-tool-05', 'Dotfile Sync', 'Diff engine', 'pilot', 'claude-opus-4-6', 45000, 16000, 2.50, datetime('now', '-37 days'));

-- ============================================================================
-- ACTIVITY LOG
-- ============================================================================

-- SaaS Dashboard activity
INSERT OR IGNORE INTO activity_log (id, project_id, event_type, message, created_at) VALUES
  ('act-s-01', 'proj-saas-dashboard-01', 'project_created', 'Project created: SaaS Dashboard', datetime('now', '-14 days')),
  ('act-s-02', 'proj-saas-dashboard-01', 'phase_started', 'Phase 1: Project Scaffolding started', datetime('now', '-14 days')),
  ('act-s-03', 'proj-saas-dashboard-01', 'task_completed', 'Completed: Initialize Next.js project', datetime('now', '-14 days', '+2 hours')),
  ('act-s-04', 'proj-saas-dashboard-01', 'task_completed', 'Completed: Set up Prisma schema', datetime('now', '-14 days', '+4 hours')),
  ('act-s-05', 'proj-saas-dashboard-01', 'task_completed', 'Completed: Implement NextAuth', datetime('now', '-13 days', '+3 hours')),
  ('act-s-06', 'proj-saas-dashboard-01', 'phase_completed', 'Phase 1: Project Scaffolding completed — $6.20', datetime('now', '-13 days', '+6 hours')),
  ('act-s-07', 'proj-saas-dashboard-01', 'phase_started', 'Phase 2: Dashboard Core started', datetime('now', '-12 days')),
  ('act-s-08', 'proj-saas-dashboard-01', 'task_completed', 'Completed: Build chart components', datetime('now', '-12 days', '+3 hours')),
  ('act-s-09', 'proj-saas-dashboard-01', 'task_completed', 'Completed: Build dashboard page', datetime('now', '-10 days', '+2 hours')),
  ('act-s-10', 'proj-saas-dashboard-01', 'phase_completed', 'Phase 2: Dashboard Core completed — $8.50', datetime('now', '-10 days', '+5 hours')),
  ('act-s-11', 'proj-saas-dashboard-01', 'phase_started', 'Phase 3: User Management started', datetime('now', '-9 days')),
  ('act-s-12', 'proj-saas-dashboard-01', 'decision_made', 'Chose role-based access control over attribute-based for MVP scope', datetime('now', '-8 days')),
  ('act-s-13', 'proj-saas-dashboard-01', 'task_completed', 'Completed: Implement RBAC', datetime('now', '-8 days', '+4 hours')),
  ('act-s-14', 'proj-saas-dashboard-01', 'phase_completed', 'Phase 3: User Management completed — $9.80', datetime('now', '-7 days', '+6 hours')),
  ('act-s-15', 'proj-saas-dashboard-01', 'phase_started', 'Phase 4: Billing Integration started', datetime('now', '-5 days')),
  ('act-s-16', 'proj-saas-dashboard-01', 'task_started', 'Started: Stripe checkout integration', datetime('now', '-5 days')),
  ('act-s-17', 'proj-saas-dashboard-01', 'decision_made', 'Using Stripe Checkout Sessions over custom payment forms for faster MVP', datetime('now', '-4 days'));

-- Mobile App activity
INSERT OR IGNORE INTO activity_log (id, project_id, event_type, message, created_at) VALUES
  ('act-m-01', 'proj-mobile-app-02', 'project_created', 'Project created: TaskFlow Mobile', datetime('now', '-21 days')),
  ('act-m-02', 'proj-mobile-app-02', 'phase_started', 'Phase 1: Offline Storage Layer started', datetime('now', '-21 days')),
  ('act-m-03', 'proj-mobile-app-02', 'task_completed', 'Completed: Set up WatermelonDB', datetime('now', '-20 days')),
  ('act-m-04', 'proj-mobile-app-02', 'task_completed', 'Completed: Build sync engine', datetime('now', '-18 days')),
  ('act-m-05', 'proj-mobile-app-02', 'phase_completed', 'Phase 1: Offline Storage Layer completed — $7.50', datetime('now', '-18 days', '+4 hours')),
  ('act-m-06', 'proj-mobile-app-02', 'phase_started', 'Phase 2: Push Notifications started', datetime('now', '-17 days')),
  ('act-m-07', 'proj-mobile-app-02', 'decision_made', 'Chose React Native Firebase over Notifee for simpler FCM integration', datetime('now', '-17 days')),
  ('act-m-08', 'proj-mobile-app-02', 'task_completed', 'Completed: FCM/APNs setup', datetime('now', '-16 days')),
  ('act-m-09', 'proj-mobile-app-02', 'phase_completed', 'Phase 2: Push Notifications completed — $6.25', datetime('now', '-14 days', '+3 hours')),
  ('act-m-10', 'proj-mobile-app-02', 'phase_started', 'Phase 3: Task Views started', datetime('now', '-10 days')),
  ('act-m-11', 'proj-mobile-app-02', 'task_started', 'Started: Kanban board', datetime('now', '-10 days')),
  ('act-m-12', 'proj-mobile-app-02', 'decision_made', 'Using react-native-reanimated for drag-and-drop over PanResponder', datetime('now', '-9 days'));

-- API Gateway activity
INSERT OR IGNORE INTO activity_log (id, project_id, event_type, message, created_at) VALUES
  ('act-a-01', 'proj-api-gateway-03', 'project_created', 'Project created: API Gateway', datetime('now', '-7 days')),
  ('act-a-02', 'proj-api-gateway-03', 'phase_started', 'Phase 1: Core Routing started', datetime('now', '-7 days')),
  ('act-a-03', 'proj-api-gateway-03', 'task_completed', 'Completed: Router implementation', datetime('now', '-6 days')),
  ('act-a-04', 'proj-api-gateway-03', 'task_completed', 'Completed: Middleware pipeline', datetime('now', '-6 days', '+4 hours')),
  ('act-a-05', 'proj-api-gateway-03', 'decision_made', 'Chose YAML over TOML for gateway config — better ecosystem support', datetime('now', '-6 days')),
  ('act-a-06', 'proj-api-gateway-03', 'task_completed', 'Completed: Config loader', datetime('now', '-5 days')),
  ('act-a-07', 'proj-api-gateway-03', 'phase_completed', 'Phase 1: Core Routing completed — $5.20', datetime('now', '-5 days', '+3 hours')),
  ('act-a-08', 'proj-api-gateway-03', 'phase_started', 'Phase 2: Auth & Rate Limiting started', datetime('now', '-4 days')),
  ('act-a-09', 'proj-api-gateway-03', 'task_started', 'Started: JWT validation middleware', datetime('now', '-4 days')),
  ('act-a-10', 'proj-api-gateway-03', 'decision_made', 'Token bucket over sliding window for rate limiting — lower memory footprint', datetime('now', '-2 days'));

-- Blog & CLI activity
INSERT OR IGNORE INTO activity_log (id, project_id, event_type, message, created_at) VALUES
  ('act-b-01', 'proj-blog-engine-04', 'project_imported', 'Project imported: Personal Blog', datetime('now', '-30 days')),
  ('act-b-02', 'proj-blog-engine-04', 'project_updated', 'Updated description and tech stack', datetime('now', '-2 days')),
  ('act-c-01', 'proj-cli-tool-05', 'project_created', 'Project created: DevSync CLI', datetime('now', '-45 days')),
  ('act-c-02', 'proj-cli-tool-05', 'phase_completed', 'Phase 2: Dotfile Sync completed — $5.00', datetime('now', '-35 days')),
  ('act-c-03', 'proj-cli-tool-05', 'project_archived', 'Project archived: DevSync CLI — v1.0 complete', datetime('now', '-15 days'));

-- ============================================================================
-- DECISIONS
-- ============================================================================

INSERT OR IGNORE INTO decisions (id, project_id, phase, category, question, answer, reasoning, created_at) VALUES
  ('dec-s-01', 'proj-saas-dashboard-01', 'Project Scaffolding', 'architecture', 'Which ORM to use?', 'Prisma', 'Type-safe queries, excellent migration system, and strong Next.js integration.', datetime('now', '-14 days')),
  ('dec-s-02', 'proj-saas-dashboard-01', 'Project Scaffolding', 'architecture', 'Authentication approach?', 'NextAuth with OAuth providers', 'Battle-tested library with built-in Google/GitHub OAuth, session management, and CSRF protection.', datetime('now', '-13 days')),
  ('dec-s-03', 'proj-saas-dashboard-01', 'User Management', 'design', 'RBAC vs ABAC for access control?', 'RBAC with three roles: admin, editor, viewer', 'Simpler to implement and reason about for MVP. Can evolve to ABAC later if needed.', datetime('now', '-8 days')),
  ('dec-s-04', 'proj-saas-dashboard-01', 'Billing Integration', 'technology', 'Custom payment forms or Stripe Checkout?', 'Stripe Checkout Sessions', 'Faster to implement, PCI-compliant by default, handles 3D Secure automatically.', datetime('now', '-4 days')),
  ('dec-s-05', 'proj-saas-dashboard-01', 'Dashboard Core', 'technology', 'Chart library selection?', 'Recharts', 'React-first API, good TypeScript support, responsive by default. Lighter than D3 for our use case.', datetime('now', '-12 days'));

INSERT OR IGNORE INTO decisions (id, project_id, phase, category, question, answer, reasoning, created_at) VALUES
  ('dec-m-01', 'proj-mobile-app-02', 'Offline Storage Layer', 'architecture', 'Offline database choice?', 'WatermelonDB with SQLite', 'Lazy loading, excellent React Native integration, built-in sync primitives.', datetime('now', '-21 days')),
  ('dec-m-02', 'proj-mobile-app-02', 'Offline Storage Layer', 'design', 'Sync conflict resolution strategy?', 'Last-write-wins with server authority', 'Simplest strategy that works for task management. Field-level merge too complex for MVP.', datetime('now', '-19 days')),
  ('dec-m-03', 'proj-mobile-app-02', 'Push Notifications', 'technology', 'Notification library?', 'React Native Firebase', 'Unified API for FCM and APNs, good community support, handles background messages.', datetime('now', '-17 days')),
  ('dec-m-04', 'proj-mobile-app-02', 'Task Views', 'technology', 'Drag-and-drop library?', 'react-native-reanimated + gesture-handler', 'Native-thread animations for 60fps drag, works with FlatList for large lists.', datetime('now', '-9 days'));

INSERT OR IGNORE INTO decisions (id, project_id, phase, category, question, answer, reasoning, created_at) VALUES
  ('dec-a-01', 'proj-api-gateway-03', 'Core Routing', 'architecture', 'Router data structure?', 'Trie-based routing', 'O(k) lookup where k is path segment count. Supports wildcards and path params naturally.', datetime('now', '-7 days')),
  ('dec-a-02', 'proj-api-gateway-03', 'Core Routing', 'technology', 'Config file format?', 'YAML', 'Better ecosystem support, human-readable, widespread in gateway/proxy tools (Nginx, Kong, Envoy).', datetime('now', '-6 days')),
  ('dec-a-03', 'proj-api-gateway-03', 'Auth & Rate Limiting', 'technology', 'JWT algorithm?', 'RS256', 'Asymmetric keys allow gateway to validate without shared secrets. Standard in microservice architectures.', datetime('now', '-3 days')),
  ('dec-a-04', 'proj-api-gateway-03', 'Auth & Rate Limiting', 'architecture', 'Rate limiting algorithm?', 'Token bucket with Redis', 'Lower memory than sliding window, configurable burst. Redis backend for distributed operation.', datetime('now', '-2 days'));

-- ============================================================================
-- GSD TODOS
-- ============================================================================

-- SaaS Dashboard todos
INSERT OR IGNORE INTO gsd_todos (id, project_id, title, description, area, phase, priority, status, is_blocker, created_at) VALUES
  ('todo-s-01', 'proj-saas-dashboard-01', 'Configure Stripe API keys in environment', 'Need to set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in Vercel env vars before billing can be tested.', 'billing', '4', 'critical', 'pending', 1, datetime('now', '-3 days')),
  ('todo-s-02', 'proj-saas-dashboard-01', 'Add rate limiting to auth endpoints', 'Login and registration endpoints need rate limiting to prevent brute force attacks.', 'security', '3', 'high', 'pending', 0, datetime('now', '-7 days')),
  ('todo-s-03', 'proj-saas-dashboard-01', 'Write E2E tests for checkout flow', 'Full Playwright test for subscription purchase, upgrade, and cancellation.', 'testing', '4', 'medium', 'pending', 0, datetime('now', '-4 days')),
  ('todo-s-04', 'proj-saas-dashboard-01', 'Fix WebSocket reconnection timeout', 'Reconnection test failing — exponential backoff exceeds 5s limit in test env.', 'bugfix', '2', 'high', 'done', 0, datetime('now', '-10 days'));

-- Mobile App todos
INSERT OR IGNORE INTO gsd_todos (id, project_id, title, description, area, phase, priority, status, is_blocker, created_at) VALUES
  ('todo-m-01', 'proj-mobile-app-02', 'Fix FlatList key extractor crash', 'KeyExtractor returning undefined for newly created items — causes render crash.', 'bugfix', '3', 'critical', 'pending', 1, datetime('now', '-9 days')),
  ('todo-m-02', 'proj-mobile-app-02', 'Add haptic feedback to drag-and-drop', 'Use react-native-haptic-feedback for tactile response on card pickup and drop.', 'ux', '3', 'low', 'pending', 0, datetime('now', '-8 days')),
  ('todo-m-03', 'proj-mobile-app-02', 'Investigate WatermelonDB migration failures', 'Two migration tests failing — column not found after v1-to-v2 migration.', 'bugfix', '1', 'high', 'pending', 1, datetime('now', '-18 days')),
  ('todo-m-04', 'proj-mobile-app-02', 'Add offline indicator banner', 'Show a persistent banner when device is offline and sync is paused.', 'ux', '1', 'medium', 'done', 0, datetime('now', '-20 days')),
  ('todo-m-05', 'proj-mobile-app-02', 'Profile app startup time', 'Measure cold start on iOS and Android, target < 2 seconds.', 'performance', '4', 'medium', 'pending', 0, datetime('now', '-10 days'));

-- API Gateway todos
INSERT OR IGNORE INTO gsd_todos (id, project_id, title, description, area, phase, priority, status, is_blocker, created_at) VALUES
  ('todo-a-01', 'proj-api-gateway-03', 'Fix empty path segment panic', 'Router panics on empty path segment — needs bounds check before trie traversal.', 'bugfix', '1', 'high', 'pending', 0, datetime('now', '-5 days')),
  ('todo-a-02', 'proj-api-gateway-03', 'Add OpenAPI spec generation', 'Auto-generate OpenAPI 3.1 spec from route definitions for documentation.', 'feature', '3', 'medium', 'pending', 0, datetime('now', '-3 days'));

-- CLI Tool todos
INSERT OR IGNORE INTO gsd_todos (id, project_id, title, description, area, phase, priority, status, is_blocker, created_at, completed_at) VALUES
  ('todo-c-01', 'proj-cli-tool-05', 'Add shell completions', 'Generate bash/zsh/fish completions using clap_complete.', 'feature', '2', 'low', 'done', 0, datetime('now', '-40 days'), datetime('now', '-36 days'));

-- ============================================================================
-- GSD MILESTONES
-- ============================================================================

INSERT OR IGNORE INTO gsd_milestones (id, project_id, name, version, phase_start, phase_end, status, completed_at, created_at) VALUES
  ('ms-s-01', 'proj-saas-dashboard-01', 'MVP Launch', 'v1.0', '1', '5', 'active', NULL, datetime('now', '-14 days')),
  ('ms-m-01', 'proj-mobile-app-02', 'Feature Release', 'v2.0', '1', '4', 'active', NULL, datetime('now', '-21 days')),
  ('ms-a-01', 'proj-api-gateway-03', 'Initial Release', 'v0.1', '1', '3', 'active', NULL, datetime('now', '-7 days')),
  ('ms-c-01', 'proj-cli-tool-05', 'First Release', 'v1.0', '1', '2', 'completed', datetime('now', '-15 days'), datetime('now', '-45 days'));

-- ============================================================================
-- GSD REQUIREMENTS
-- ============================================================================

INSERT OR IGNORE INTO gsd_requirements (id, project_id, req_id, description, category, priority, scope, phase, status, created_at) VALUES
  ('req-s-01', 'proj-saas-dashboard-01', 'REQ-001', 'Users can sign up and log in with Google or GitHub OAuth', 'auth', 'critical', 'v1', '1', 'completed', datetime('now', '-14 days')),
  ('req-s-02', 'proj-saas-dashboard-01', 'REQ-002', 'Dashboard shows real-time analytics with line, bar, and pie charts', 'dashboard', 'critical', 'v1', '2', 'completed', datetime('now', '-14 days')),
  ('req-s-03', 'proj-saas-dashboard-01', 'REQ-003', 'Admin users can invite, edit roles, and remove team members', 'user-mgmt', 'high', 'v1', '3', 'completed', datetime('now', '-14 days')),
  ('req-s-04', 'proj-saas-dashboard-01', 'REQ-004', 'Stripe subscription checkout with usage-based billing', 'billing', 'critical', 'v1', '4', 'in_progress', datetime('now', '-14 days')),
  ('req-s-05', 'proj-saas-dashboard-01', 'REQ-005', 'Production deployment with CI/CD and error monitoring', 'devops', 'high', 'v1', '5', 'pending', datetime('now', '-14 days')),
  ('req-m-01', 'proj-mobile-app-02', 'REQ-001', 'App works fully offline and syncs when connectivity returns', 'offline', 'critical', 'v2', '1', 'completed', datetime('now', '-21 days')),
  ('req-m-02', 'proj-mobile-app-02', 'REQ-002', 'Cross-platform push notifications for task reminders and updates', 'notifications', 'high', 'v2', '2', 'completed', datetime('now', '-21 days')),
  ('req-m-03', 'proj-mobile-app-02', 'REQ-003', 'Kanban board with drag-and-drop and calendar view for tasks', 'views', 'critical', 'v2', '3', 'in_progress', datetime('now', '-21 days')),
  ('req-m-04', 'proj-mobile-app-02', 'REQ-004', 'App startup under 2 seconds with smooth 60fps animations', 'performance', 'medium', 'v2', '4', 'pending', datetime('now', '-21 days'));

-- ============================================================================
-- TEST RUNS
-- ============================================================================

INSERT OR IGNORE INTO test_runs (id, project_id, phase, total_tests, passed, failed, skipped, duration_ms, coverage_lines, coverage_branches, coverage_functions, started_at, completed_at, created_at) VALUES
  ('tr-s-01', 'proj-saas-dashboard-01', 'Dashboard Core', 42, 40, 1, 1, 8500, 78.5, 65.2, 82.0,
   datetime('now', '-10 days'), datetime('now', '-10 days', '+8 seconds'), datetime('now', '-10 days')),
  ('tr-s-02', 'proj-saas-dashboard-01', 'User Management', 56, 55, 0, 1, 12300, 85.3, 72.1, 88.5,
   datetime('now', '-7 days'), datetime('now', '-7 days', '+12 seconds'), datetime('now', '-7 days')),
  ('tr-m-01', 'proj-mobile-app-02', 'Offline Storage Layer', 38, 36, 2, 0, 6200, 72.0, 58.4, 76.3,
   datetime('now', '-18 days'), datetime('now', '-18 days', '+6 seconds'), datetime('now', '-18 days')),
  ('tr-m-02', 'proj-mobile-app-02', 'Push Notifications', 24, 24, 0, 0, 4100, 81.2, 68.0, 84.5,
   datetime('now', '-14 days'), datetime('now', '-14 days', '+4 seconds'), datetime('now', '-14 days')),
  ('tr-a-01', 'proj-api-gateway-03', 'Core Routing', 65, 63, 1, 1, 3200, 88.7, 76.3, 91.2,
   datetime('now', '-5 days'), datetime('now', '-5 days', '+3 seconds'), datetime('now', '-5 days')),
  ('tr-a-02', 'proj-api-gateway-03', 'Auth & Rate Limiting', 28, 26, 2, 0, 2100, 74.5, 60.1, 79.8,
   datetime('now', '-3 days'), datetime('now', '-3 days', '+2 seconds'), datetime('now', '-3 days'));

-- ============================================================================
-- TEST RESULTS (individual tests)
-- ============================================================================

INSERT OR IGNORE INTO test_results (id, test_run_id, test_name, test_file, status, duration_ms, error_message) VALUES
  ('tres-s01-01', 'tr-s-01', 'renders line chart with data', 'src/components/charts/line-chart.test.tsx', 'passed', 120, NULL),
  ('tres-s01-02', 'tr-s-01', 'renders bar chart with categories', 'src/components/charts/bar-chart.test.tsx', 'passed', 95, NULL),
  ('tres-s01-03', 'tr-s-01', 'handles empty dataset gracefully', 'src/components/charts/line-chart.test.tsx', 'passed', 45, NULL),
  ('tres-s01-04', 'tr-s-01', 'fetches analytics data on mount', 'src/hooks/use-analytics.test.ts', 'passed', 230, NULL),
  ('tres-s01-05', 'tr-s-01', 'websocket reconnects on close', 'src/hooks/use-realtime.test.ts', 'failed', 5200, 'Timeout: reconnection took longer than 5s'),
  ('tres-s01-06', 'tr-s-01', 'responsive chart resize', 'src/components/charts/responsive.test.tsx', 'skipped', 0, NULL),
  ('tres-m01-01', 'tr-m-01', 'creates task offline', 'src/models/task.test.ts', 'passed', 85, NULL),
  ('tres-m01-02', 'tr-m-01', 'syncs pending changes', 'src/sync/engine.test.ts', 'passed', 340, NULL),
  ('tres-m01-03', 'tr-m-01', 'resolves conflict with LWW', 'src/sync/conflict.test.ts', 'passed', 210, NULL),
  ('tres-m01-04', 'tr-m-01', 'migration v1 to v2', 'src/models/migrations.test.ts', 'failed', 1200, 'Column tasks.priority not found after migration'),
  ('tres-m01-05', 'tr-m-01', 'migration v2 to v3', 'src/models/migrations.test.ts', 'failed', 800, 'Foreign key constraint violation on project_id'),
  ('tres-a01-01', 'tr-a-01', 'routes static path', 'tests/router.rs', 'passed', 12, NULL),
  ('tres-a01-02', 'tr-a-01', 'routes with path params', 'tests/router.rs', 'passed', 15, NULL),
  ('tres-a01-03', 'tr-a-01', 'middleware executes in order', 'tests/middleware.rs', 'passed', 25, NULL),
  ('tres-a01-04', 'tr-a-01', 'handles malformed request', 'tests/router.rs', 'failed', 45, 'Panic on empty path segment — needs bounds check'),
  ('tres-a01-05', 'tr-a-01', 'config hot-reload', 'tests/config.rs', 'skipped', 0, NULL);

-- ============================================================================
-- KNOWLEDGE
-- ============================================================================

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

  ('kn-s-04', 'proj-saas-dashboard-01', 'TanStack Query cache invalidation patterns',
   'Use queryKey factories for consistent cache keys. Invalidate related queries after mutations using `queryClient.invalidateQueries()`. Set staleTime to 5 minutes for dashboard data, 30 seconds for real-time metrics.',
   'learning', 'Phase 2: Dashboard Core', '{"tags":["react-query","caching","data-fetching"]}', datetime('now', '-11 days')),

  ('kn-s-05', 'proj-saas-dashboard-01', 'RBAC middleware implementation',
   'Three-tier role system: admin > editor > viewer. Middleware checks session.user.role against route requirements. API routes use withAuth(handler, requiredRole) wrapper.',
   'decision', 'Phase 3: User Management', '{"tags":["security","rbac","authorization"]}', datetime('now', '-8 days')),

  ('kn-m-01', 'proj-mobile-app-02', 'WatermelonDB migration gotcha',
   'Migrations must be additive only. Cannot remove columns in production. Use schemaMigrations() with version bumps. Test migrations on a copy of production data before release.',
   'learning', 'Phase 1: Offline Storage', '{"tags":["database","watermelondb","migrations"]}', datetime('now', '-20 days')),

  ('kn-m-02', 'proj-mobile-app-02', 'iOS push notification entitlements',
   'Must enable Push Notifications capability in Xcode AND create APNs key in Apple Developer Console. Sandbox vs Production environments require different endpoints. Test on physical device — simulator does not support push.',
   'fact', 'Phase 2: Push Notifications', '{"tags":["ios","push-notifications","xcode"]}', datetime('now', '-17 days')),

  ('kn-m-03', 'proj-mobile-app-02', 'Offline-first sync conflict resolution',
   'Last-write-wins (LWW) strategy with server authority. Track `updated_at` timestamps in ISO 8601 format. When conflict detected: server version wins, local version preserved in conflict queue for user review.',
   'decision', 'Phase 1: Offline Storage', '{"tags":["sync","offline","conflict-resolution"]}', datetime('now', '-19 days')),

  ('kn-m-04', 'proj-mobile-app-02', 'FlatList optimization techniques',
   'Use `getItemLayout` for fixed-height items. Set `maxToRenderPerBatch` to 10, `windowSize` to 5. Use `React.memo()` for list items. For large lists, consider FlashList from Shopify.',
   'learning', 'Phase 3: Task Views', '{"tags":["react-native","flatlist","performance"]}', datetime('now', '-10 days')),

  ('kn-a-01', 'proj-api-gateway-03', 'Axum state sharing',
   'Use Extension layer for shared state. Arc<T> for thread-safe sharing across handlers. For mutable state, Arc<RwLock<T>>. Prefer RwLock when reads vastly outnumber writes.',
   'learning', 'Phase 1: Core Routing', '{"tags":["axum","rust","state-management"]}', datetime('now', '-6 days')),

  ('kn-a-02', 'proj-api-gateway-03', 'Trie router benchmarks',
   'Custom trie router benchmarks: 2.3M req/s for static routes, 1.8M req/s with path parameters, 1.5M req/s with wildcards. Measured on M2 Pro with criterion.rs. Outperforms regex-based routing by 4x.',
   'fact', 'Phase 1: Core Routing', '{"tags":["performance","benchmarks","routing"]}', datetime('now', '-6 days', '+2 hours')),

  ('kn-a-03', 'proj-api-gateway-03', 'Token bucket rate limiter design',
   'Each bucket: capacity (burst size), refill rate (requests/second), current tokens. Check: if tokens >= 1, decrement and allow; otherwise reject with 429. Redis backend with Lua script for atomic check-and-decrement.',
   'decision', 'Phase 2: Auth & Rate Limiting', '{"tags":["rate-limiting","redis","algorithm"]}', datetime('now', '-2 days'));

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

INSERT OR IGNORE INTO notifications (id, project_id, notification_type, title, message, link, read, created_at) VALUES
  ('notif-01', 'proj-saas-dashboard-01', 'success', 'Phase 3 Completed', 'User Management phase finished — all 4 tasks done, $9.80 spent', '/project/proj-saas-dashboard-01', 1, datetime('now', '-7 days')),
  ('notif-02', 'proj-saas-dashboard-01', 'error', 'Test Failure Detected', 'WebSocket reconnection test timed out in Dashboard Core phase', '/project/proj-saas-dashboard-01', 1, datetime('now', '-10 days')),
  ('notif-03', 'proj-saas-dashboard-01', 'warning', 'Blocker: Stripe API Keys Missing', 'Billing phase blocked — configure STRIPE_SECRET_KEY in environment', '/project/proj-saas-dashboard-01', 0, datetime('now', '-3 days')),
  ('notif-04', 'proj-mobile-app-02', 'success', 'Push Notifications Phase Complete', 'All 4 tasks completed, cross-platform push working', '/project/proj-mobile-app-02', 1, datetime('now', '-14 days')),
  ('notif-05', 'proj-mobile-app-02', 'error', 'Migration Tests Failed', '2 migration tests failed — column not found after schema update', '/project/proj-mobile-app-02', 0, datetime('now', '-18 days')),
  ('notif-06', 'proj-mobile-app-02', 'warning', 'FlatList Crash in Kanban', 'KeyExtractor returning undefined for new items — runtime crash on render', '/project/proj-mobile-app-02', 0, datetime('now', '-9 days')),
  ('notif-07', 'proj-api-gateway-03', 'success', 'Core Routing Complete', 'Phase 1 finished — 2.3M req/s benchmark achieved', '/project/proj-api-gateway-03', 1, datetime('now', '-5 days')),
  ('notif-08', 'proj-api-gateway-03', 'info', 'Cost Approaching Threshold', 'API Gateway at $8.20 of $25.00 budget — 33% used', '/project/proj-api-gateway-03', 0, datetime('now', '-2 days')),
  ('notif-09', NULL, 'info', 'Welcome to Track Your Shit', 'Your project management dashboard is ready. Import projects or create new ones to get started.', '/', 1, datetime('now', '-14 days'));

-- ============================================================================
-- APP LOGS (mix of levels for the logs page)
-- ============================================================================

INSERT OR IGNORE INTO app_logs (id, level, target, message, source, project_id, metadata, created_at) VALUES
  ('log-01', 'info', 'db::pool', 'Database pool initialized: 1 writer + 4 readers', 'backend', NULL, NULL, datetime('now', '-14 days')),
  ('log-02', 'info', 'projects', 'Project imported: SaaS Dashboard', 'backend', 'proj-saas-dashboard-01', '{"path":"/Users/demo/projects/saas-dashboard"}', datetime('now', '-14 days')),
  ('log-03', 'info', 'projects', 'Project imported: TaskFlow Mobile', 'backend', 'proj-mobile-app-02', NULL, datetime('now', '-21 days')),
  ('log-04', 'warn', 'git', 'Git repository has uncommitted changes', 'backend', 'proj-saas-dashboard-01', '{"dirty_files":3}', datetime('now', '-5 days')),
  ('log-05', 'error', 'pty', 'PTY session failed to spawn: command not found', 'backend', 'proj-api-gateway-03', '{"command":"cargo","error":"No such file or directory"}', datetime('now', '-4 days')),
  ('log-06', 'debug', 'watcher', 'File change detected: .planning/phases/4/PLAN.md', 'backend', 'proj-saas-dashboard-01', NULL, datetime('now', '-5 days')),
  ('log-07', 'info', 'gsd::sync', 'GSD sync completed: 3 todos imported, 1 milestone updated', 'backend', 'proj-mobile-app-02', '{"todos_imported":3,"milestones_updated":1}', datetime('now', '-10 days')),
  ('log-08', 'warn', 'costs', 'Project approaching cost threshold', 'backend', 'proj-api-gateway-03', '{"current":8.20,"threshold":25.00}', datetime('now', '-2 days')),
  ('log-09', 'error', 'knowledge', 'Failed to parse markdown file: invalid YAML frontmatter', 'backend', 'proj-blog-engine-04', '{"file":"docs/draft-post.md","line":3}', datetime('now', '-2 days')),
  ('log-10', 'info', 'db::migration', 'Applied migration: gsd_tables_full_rebuild', 'backend', NULL, NULL, datetime('now', '-14 days')),
  ('log-11', 'debug', 'queries', 'Query execution: get_projects_with_stats took 12ms', 'backend', NULL, '{"duration_ms":12}', datetime('now', '-1 hour')),
  ('log-12', 'info', 'settings', 'Theme changed to dark mode', 'frontend', NULL, NULL, datetime('now', '-13 days')),
  ('log-13', 'warn', 'knowledge', 'Large markdown file truncated for display', 'frontend', 'proj-saas-dashboard-01', '{"file":"ARCHITECTURE.md","size_kb":245}', datetime('now', '-12 days')),
  ('log-14', 'error', 'ipc', 'Tauri invoke failed: get_git_status — repository not found', 'frontend', 'proj-blog-engine-04', '{"command":"get_git_status"}', datetime('now', '-3 days')),
  ('log-15', 'info', 'app', 'Application started — v0.1.0', 'backend', NULL, '{"version":"0.1.0","platform":"darwin"}', datetime('now', '-14 days'));

-- ============================================================================
-- SNIPPETS (command shortcuts)
-- ============================================================================

INSERT OR IGNORE INTO snippets (id, project_id, label, command, description, category, created_at) VALUES
  ('snip-01', 'proj-saas-dashboard-01', 'Dev Server', 'pnpm dev', 'Start Next.js development server', 'development', datetime('now', '-14 days')),
  ('snip-02', 'proj-saas-dashboard-01', 'DB Migrate', 'pnpm prisma migrate dev', 'Run Prisma database migrations', 'database', datetime('now', '-14 days')),
  ('snip-03', 'proj-saas-dashboard-01', 'Run Tests', 'pnpm test', 'Run Vitest test suite', 'testing', datetime('now', '-12 days')),
  ('snip-04', 'proj-mobile-app-02', 'iOS Build', 'npx react-native run-ios', 'Build and run on iOS simulator', 'development', datetime('now', '-21 days')),
  ('snip-05', 'proj-mobile-app-02', 'Android Build', 'npx react-native run-android', 'Build and run on Android emulator', 'development', datetime('now', '-21 days')),
  ('snip-06', 'proj-api-gateway-03', 'Build Release', 'cargo build --release', 'Compile optimized release binary', 'development', datetime('now', '-7 days')),
  ('snip-07', 'proj-api-gateway-03', 'Run Benchmarks', 'cargo bench', 'Run criterion.rs benchmarks', 'testing', datetime('now', '-6 days'));

-- ============================================================================
-- COST THRESHOLDS
-- ============================================================================

INSERT OR IGNORE INTO cost_thresholds (id, project_id, warn_cost, alert_cost, stop_cost, enabled) VALUES
  ('ct-01', 'proj-saas-dashboard-01', 15.00, 35.00, 60.00, 1),
  ('ct-02', 'proj-mobile-app-02', 12.00, 30.00, 50.00, 1),
  ('ct-03', 'proj-api-gateway-03', 10.00, 25.00, 40.00, 1);

-- ============================================================================
-- SETTINGS
-- ============================================================================

INSERT OR REPLACE INTO settings (key, value) VALUES
  ('theme', '"dark"'),
  ('sidebar_collapsed', 'false'),
  ('notifications_enabled', 'true'),
  ('terminal_font_size', '13');
