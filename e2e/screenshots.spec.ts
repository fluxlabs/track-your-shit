// Track Your Shit - Automated Screenshot Capture for Website
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '../website/screenshots');

// Mock data that simulates a realistic app state
const MOCK_PROJECTS = [
  {
    id: 'proj-001',
    name: 'SaaS Dashboard',
    path: '/Users/dev/projects/saas-dashboard',
    description: 'Full-stack analytics dashboard with real-time metrics, user management, and billing integration.',
    tech_stack: {
      framework: 'Next.js',
      language: 'TypeScript',
      package_manager: 'pnpm',
      database: 'PostgreSQL',
      test_framework: 'Vitest',
      has_planning: true,
      gsd_phase_count: 8,
      gsd_todo_count: 3,
      gsd_has_requirements: true,
    },
    config: null,
    status: 'active',
    is_favorite: true,
    created_at: '2026-01-15T10:00:00',
    updated_at: '2026-02-20T14:30:00',
  },
  {
    id: 'proj-002',
    name: 'TaskFlow Mobile',
    path: '/Users/dev/projects/taskflow-mobile',
    description: 'Cross-platform mobile app with offline sync, kanban boards, and team collaboration features.',
    tech_stack: {
      framework: 'React Native',
      language: 'TypeScript',
      package_manager: 'npm',
      database: 'SQLite',
      test_framework: 'Jest',
      has_planning: true,
      gsd_phase_count: 6,
      gsd_todo_count: 5,
      gsd_has_requirements: true,
    },
    config: null,
    status: 'active',
    is_favorite: true,
    created_at: '2026-01-20T09:00:00',
    updated_at: '2026-02-19T16:45:00',
  },
  {
    id: 'proj-003',
    name: 'API Gateway',
    path: '/Users/dev/projects/api-gateway',
    description: 'High-performance API gateway with rate limiting, auth middleware, and request transformation.',
    tech_stack: {
      framework: 'Axum',
      language: 'Rust',
      package_manager: 'cargo',
      database: 'Redis',
      test_framework: 'cargo test',
      has_planning: true,
      gsd_phase_count: 5,
      gsd_todo_count: 2,
      gsd_has_requirements: true,
    },
    config: null,
    status: 'active',
    is_favorite: false,
    created_at: '2026-02-01T11:00:00',
    updated_at: '2026-02-18T09:15:00',
  },
  {
    id: 'proj-004',
    name: 'Design System',
    path: '/Users/dev/projects/design-system',
    description: 'Component library with Storybook, accessibility testing, and automated visual regression.',
    tech_stack: {
      framework: 'React',
      language: 'TypeScript',
      package_manager: 'pnpm',
      database: null,
      test_framework: 'Vitest',
      has_planning: true,
      gsd_phase_count: 4,
      gsd_todo_count: 1,
      gsd_has_requirements: false,
    },
    config: null,
    status: 'active',
    is_favorite: false,
    created_at: '2026-02-05T08:30:00',
    updated_at: '2026-02-17T11:20:00',
  },
  {
    id: 'proj-005',
    name: 'ML Pipeline',
    path: '/Users/dev/projects/ml-pipeline',
    description: 'Data processing pipeline with model training, evaluation, and deployment automation.',
    tech_stack: {
      framework: 'FastAPI',
      language: 'Python',
      package_manager: 'poetry',
      database: 'PostgreSQL',
      test_framework: 'pytest',
      has_planning: true,
      gsd_phase_count: 7,
      gsd_todo_count: 4,
      gsd_has_requirements: true,
    },
    config: null,
    status: 'active',
    is_favorite: true,
    created_at: '2026-01-28T13:00:00',
    updated_at: '2026-02-20T10:00:00',
  },
  {
    id: 'proj-006',
    name: 'E-Commerce Platform',
    path: '/Users/dev/projects/ecommerce',
    description: 'Headless commerce platform with Stripe integration, inventory management, and order processing.',
    tech_stack: {
      framework: 'Remix',
      language: 'TypeScript',
      package_manager: 'pnpm',
      database: 'PostgreSQL',
      test_framework: 'Playwright',
      has_planning: false,
      gsd_phase_count: null,
      gsd_todo_count: null,
      gsd_has_requirements: false,
    },
    config: null,
    status: 'archived',
    is_favorite: false,
    created_at: '2025-12-10T10:00:00',
    updated_at: '2026-01-30T15:00:00',
  },
];

const MOCK_PROJECTS_WITH_STATS = MOCK_PROJECTS.map((p, i) => ({
  ...p,
  total_cost: [42.50, 28.75, 15.20, 8.90, 35.60, 52.30][i],
  roadmap_progress: p.tech_stack.has_planning
    ? {
        total_phases: p.tech_stack.gsd_phase_count!,
        completed_phases: [5, 3, 2, 3, 4, 0][i],
        total_tasks: [24, 18, 15, 12, 21, 0][i],
        completed_tasks: [16, 10, 6, 9, 12, 0][i],
        status: ['in_progress', 'in_progress', 'in_progress', 'in_progress', 'in_progress', 'pending'][i],
      }
    : null,
  last_activity_at: p.updated_at,
}));

const MOCK_SETTINGS = {
  theme: 'dark',
  start_on_login: false,
  default_cost_limit: 50.0,
  notifications_enabled: true,
  notify_on_complete: true,
  notify_on_error: true,
  notify_cost_threshold: 25.0,
  accent_color: 'blue',
  ui_density: 'comfortable',
  font_size_scale: 'medium',
  font_family: 'system',
  auto_open_last_project: true,
  window_state: 'maximized',
  notify_on_phase_complete: true,
  notify_on_cost_warning: true,
  debug_logging: false,
  use_tmux: false,
};

const MOCK_NOTIFICATIONS = [
  {
    id: 'notif-001',
    project_id: 'proj-001',
    notification_type: 'phase_complete',
    title: 'Phase 5 Complete',
    message: 'SaaS Dashboard: Phase 5 (Billing Integration) completed successfully. All 4 tasks passed verification.',
    link: null,
    read: false,
    created_at: '2026-02-20T14:30:00',
  },
  {
    id: 'notif-002',
    project_id: 'proj-005',
    notification_type: 'cost_warning',
    title: 'Cost Threshold Reached',
    message: 'ML Pipeline has reached $35.60 of your $50.00 cost limit (71%).',
    link: null,
    read: false,
    created_at: '2026-02-20T10:00:00',
  },
  {
    id: 'notif-003',
    project_id: 'proj-002',
    notification_type: 'todo_blocker',
    title: 'Blocker Detected',
    message: 'TaskFlow Mobile: "Fix offline sync race condition" is marked as a blocker for Phase 4.',
    link: null,
    read: false,
    created_at: '2026-02-19T16:45:00',
  },
  {
    id: 'notif-004',
    project_id: 'proj-003',
    notification_type: 'phase_complete',
    title: 'Phase 2 Complete',
    message: 'API Gateway: Phase 2 (Rate Limiting) completed. 3/3 tasks done, verification passed.',
    link: null,
    read: true,
    created_at: '2026-02-18T09:15:00',
  },
  {
    id: 'notif-005',
    project_id: null,
    notification_type: 'system',
    title: 'Dependency Update Available',
    message: '12 outdated packages detected across 3 projects. Run dependency audit for details.',
    link: null,
    read: true,
    created_at: '2026-02-17T08:00:00',
  },
];

const MOCK_TODOS = [
  {
    id: 'todo-001', title: 'Add WebSocket support for real-time updates', description: 'Implement WebSocket connections for live dashboard metrics', area: 'backend', phase: 'Phase 6', priority: 'high', is_blocker: false, files: ['src/ws/handler.rs'], status: 'pending', source_file: 'TODOS.md', created_at: '2026-02-18T10:00:00', completed_at: null, project_id: 'proj-001', project_name: 'SaaS Dashboard',
  },
  {
    id: 'todo-002', title: 'Fix offline sync race condition', description: 'Race condition when multiple tabs sync simultaneously', area: 'core', phase: 'Phase 4', priority: 'critical', is_blocker: true, files: ['src/sync/engine.ts'], status: 'pending', source_file: 'TODOS.md', created_at: '2026-02-19T11:00:00', completed_at: null, project_id: 'proj-002', project_name: 'TaskFlow Mobile',
  },
  {
    id: 'todo-003', title: 'Add rate limit bypass for internal services', description: null, area: 'middleware', phase: 'Phase 3', priority: 'medium', is_blocker: false, files: null, status: 'pending', source_file: 'TODOS.md', created_at: '2026-02-17T09:00:00', completed_at: null, project_id: 'proj-003', project_name: 'API Gateway',
  },
  {
    id: 'todo-004', title: 'Write Storybook stories for form components', description: 'Cover all variants and edge cases for form inputs', area: 'docs', phase: 'Phase 4', priority: 'low', is_blocker: false, files: ['src/components/Form/'], status: 'pending', source_file: 'TODOS.md', created_at: '2026-02-16T14:00:00', completed_at: null, project_id: 'proj-004', project_name: 'Design System',
  },
  {
    id: 'todo-005', title: 'Implement model A/B testing framework', description: 'Compare model performance with statistical significance testing', area: 'ml', phase: 'Phase 5', priority: 'high', is_blocker: false, files: ['src/eval/ab_test.py', 'src/eval/stats.py'], status: 'pending', source_file: 'TODOS.md', created_at: '2026-02-19T15:00:00', completed_at: null, project_id: 'proj-005', project_name: 'ML Pipeline',
  },
  {
    id: 'todo-006', title: 'Add caching layer for API responses', description: null, area: 'performance', phase: 'Phase 6', priority: 'medium', is_blocker: false, files: null, status: 'pending', source_file: 'TODOS.md', created_at: '2026-02-20T08:00:00', completed_at: null, project_id: 'proj-001', project_name: 'SaaS Dashboard',
  },
  {
    id: 'todo-007', title: 'Set up push notification service', description: 'FCM for Android, APNs for iOS', area: 'infra', phase: 'Phase 5', priority: 'high', is_blocker: true, files: null, status: 'pending', source_file: 'TODOS.md', created_at: '2026-02-18T12:00:00', completed_at: null, project_id: 'proj-002', project_name: 'TaskFlow Mobile',
  },
  {
    id: 'todo-008', title: 'Add GPU utilization monitoring', description: 'Track GPU memory and compute usage during training', area: 'monitoring', phase: 'Phase 6', priority: 'medium', is_blocker: false, files: ['src/monitoring/gpu.py'], status: 'pending', source_file: 'TODOS.md', created_at: '2026-02-20T09:00:00', completed_at: null, project_id: 'proj-005', project_name: 'ML Pipeline',
  },
];

const MOCK_ACTIVITY = [
  { id: 'act-001', project_id: 'proj-001', execution_id: null, event_type: 'phase_complete', message: 'Phase 5 completed: Billing Integration', metadata: { phase: 5, tasks: 4 }, created_at: '2026-02-20T14:30:00' },
  { id: 'act-002', project_id: 'proj-005', execution_id: null, event_type: 'cost_update', message: 'Cost updated: $35.60 (+$4.20)', metadata: { cost: 35.60, delta: 4.20 }, created_at: '2026-02-20T10:00:00' },
  { id: 'act-003', project_id: 'proj-002', execution_id: null, event_type: 'todo_created', message: 'New blocker: Fix offline sync race condition', metadata: null, created_at: '2026-02-19T16:45:00' },
  { id: 'act-004', project_id: 'proj-003', execution_id: null, event_type: 'phase_complete', message: 'Phase 2 completed: Rate Limiting', metadata: { phase: 2, tasks: 3 }, created_at: '2026-02-18T09:15:00' },
  { id: 'act-005', project_id: 'proj-004', execution_id: null, event_type: 'project_imported', message: 'Project imported: Design System', metadata: null, created_at: '2026-02-05T08:30:00' },
];

const MOCK_APP_LOGS = [
  { id: 'log-001', level: 'INFO', target: 'commands::projects', message: 'Listed 6 projects (5 active, 1 archived)', source: 'backend', project_id: null, metadata: null, created_at: '2026-02-20T14:35:00' },
  { id: 'log-002', level: 'INFO', target: 'commands::gsd', message: 'GSD sync completed for SaaS Dashboard: 3 todos, 8 phases', source: 'backend', project_id: 'proj-001', metadata: null, created_at: '2026-02-20T14:30:00' },
  { id: 'log-003', level: 'WARN', target: 'commands::dependencies', message: 'Found 12 outdated packages in SaaS Dashboard', source: 'backend', project_id: 'proj-001', metadata: null, created_at: '2026-02-20T14:28:00' },
  { id: 'log-004', level: 'INFO', target: 'pty::session', message: 'PTY session created: shell-001 (zsh)', source: 'backend', project_id: 'proj-001', metadata: null, created_at: '2026-02-20T14:25:00' },
  { id: 'log-005', level: 'ERROR', target: 'commands::git', message: 'Git push failed: remote rejected (pre-receive hook declined)', source: 'backend', project_id: 'proj-002', metadata: null, created_at: '2026-02-20T14:20:00' },
  { id: 'log-006', level: 'INFO', target: 'db::pool', message: 'Database connection pool initialized: 1 writer, 4 readers', source: 'backend', project_id: null, metadata: null, created_at: '2026-02-20T14:00:00' },
  { id: 'log-007', level: 'DEBUG', target: 'watcher::fs', message: 'File watcher started for /Users/dev/projects/saas-dashboard/.planning', source: 'backend', project_id: 'proj-001', metadata: null, created_at: '2026-02-20T14:00:00' },
  { id: 'log-008', level: 'INFO', target: 'app::startup', message: 'Track Your Shit v0.1.0 started successfully', source: 'backend', project_id: null, metadata: null, created_at: '2026-02-20T14:00:00' },
];

const MOCK_LOG_STATS = {
  total: 156,
  by_level: [
    { level: 'INFO', count: 98 },
    { level: 'WARN', count: 23 },
    { level: 'ERROR', count: 8 },
    { level: 'DEBUG', count: 27 },
  ],
  by_source: [
    { source: 'backend', count: 142 },
    { source: 'frontend', count: 14 },
  ],
};

const MOCK_GIT_INFO: Record<string, unknown> = {
  branch: 'main',
  is_dirty: false,
  has_git: true,
};

const MOCK_GIT_STATUS = {
  has_git: true,
  branch: 'feature/billing',
  is_dirty: true,
  staged_count: 2,
  unstaged_count: 3,
  untracked_count: 1,
  ahead: 2,
  behind: 0,
  last_commit: {
    hash: 'a1b2c3d4e5f6',
    message: 'Add Stripe webhook handler for subscription events',
    author: 'Jeremy McSpadden',
    date: '2026-02-20T14:25:00',
  },
  stash_count: 1,
};

const MOCK_ROADMAP_PROGRESS = {
  phases: [
    { name: 'Project Scaffolding', number: 1, total: 4, completed: 4, percent: 100, status: 'complete' as const },
    { name: 'Dashboard Core', number: 2, total: 4, completed: 4, percent: 100, status: 'complete' as const },
    { name: 'User Management', number: 3, total: 4, completed: 4, percent: 100, status: 'complete' as const },
    { name: 'Analytics Engine', number: 4, total: 4, completed: 4, percent: 100, status: 'complete' as const },
    { name: 'Billing Integration', number: 5, total: 4, completed: 4, percent: 100, status: 'complete' as const },
    { name: 'Real-time Updates', number: 6, total: 3, completed: 1, percent: 33, status: 'in_progress' as const },
    { name: 'Performance Optimization', number: 7, total: 3, completed: 0, percent: 0, status: 'pending' as const },
    { name: 'Deployment & CI/CD', number: 8, total: 3, completed: 0, percent: 0, status: 'pending' as const },
  ],
  total_tasks: 29,
  completed_tasks: 21,
  percent: 72,
  current_phase: 'Real-time Updates',
};

// Build the IPC mock handler script to inject before page load
function buildMockScript(): string {
  return `
    // Initialize Tauri mock internals
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ || {};

    const callbacks = new Map();

    function registerCallback(callback, once = false) {
      const identifier = Math.floor(Math.random() * 2147483647);
      callbacks.set(identifier, (data) => {
        if (once) callbacks.delete(identifier);
        return callback && callback(data);
      });
      return identifier;
    }

    function unregisterCallback(id) { callbacks.delete(id); }
    function runCallback(id, data) {
      const cb = callbacks.get(id);
      if (cb) cb(data);
    }

    const mockProjects = ${JSON.stringify(MOCK_PROJECTS)};
    const mockProjectsWithStats = ${JSON.stringify(MOCK_PROJECTS_WITH_STATS)};
    const mockSettings = ${JSON.stringify(MOCK_SETTINGS)};
    const mockNotifications = ${JSON.stringify(MOCK_NOTIFICATIONS)};
    const mockTodos = ${JSON.stringify(MOCK_TODOS)};
    const mockActivity = ${JSON.stringify(MOCK_ACTIVITY)};
    const mockAppLogs = ${JSON.stringify(MOCK_APP_LOGS)};
    const mockLogStats = ${JSON.stringify(MOCK_LOG_STATS)};
    const mockGitInfo = ${JSON.stringify(MOCK_GIT_INFO)};
    const mockGitStatus = ${JSON.stringify(MOCK_GIT_STATUS)};
    const mockRoadmapProgress = ${JSON.stringify(MOCK_ROADMAP_PROGRESS)};

    async function invoke(cmd, args, _options) {
      // Event plugin calls
      if (cmd.startsWith('plugin:event|')) {
        if (cmd === 'plugin:event|listen') return args.handler;
        if (cmd === 'plugin:event|unlisten') return;
        if (cmd === 'plugin:event|emit') return;
        return;
      }

      // Route commands to mock data
      switch (cmd) {
        case 'list_projects': return mockProjects;
        case 'get_projects_with_stats': return mockProjectsWithStats;
        case 'get_project': return mockProjects.find(p => p.id === args.id) || mockProjects[0];
        case 'get_settings': return mockSettings;
        case 'get_notifications': return args.unreadOnly ? mockNotifications.filter(n => !n.read) : mockNotifications;
        case 'get_unread_notification_count': return mockNotifications.filter(n => !n.read).length;
        case 'gsd_list_all_todos': return mockTodos;
        case 'gsd_list_todos': return mockTodos.filter(t => t.project_id === args.projectId);
        case 'get_activity_log': return mockActivity;
        case 'get_app_logs': return mockAppLogs;
        case 'get_app_log_stats': return mockLogStats;
        case 'get_log_levels': return ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        case 'get_git_info': return mockGitInfo;
        case 'get_git_status': return mockGitStatus;
        case 'git_changed_files': return [
          { path: 'src/billing/stripe.ts', status: 'modified', staged: true },
          { path: 'src/billing/webhook.ts', status: 'added', staged: true },
          { path: 'src/api/routes.ts', status: 'modified', staged: false },
          { path: 'src/lib/utils.ts', status: 'modified', staged: false },
          { path: 'tests/billing.test.ts', status: 'modified', staged: false },
          { path: '.env.example', status: 'added', staged: false },
        ];
        case 'git_log': return [
          { hash: 'a1b2c3d', short_hash: 'a1b2c3d', message: 'Add Stripe webhook handler for subscription events', author: 'Jeremy McSpadden', date: '2026-02-20T14:25:00', files_changed: 3, insertions: 142, deletions: 8 },
          { hash: 'b2c3d4e', short_hash: 'b2c3d4e', message: 'Implement checkout session creation', author: 'Jeremy McSpadden', date: '2026-02-20T12:10:00', files_changed: 5, insertions: 285, deletions: 12 },
          { hash: 'c3d4e5f', short_hash: 'c3d4e5f', message: 'Add billing data models and migrations', author: 'Jeremy McSpadden', date: '2026-02-20T10:00:00', files_changed: 4, insertions: 198, deletions: 0 },
          { hash: 'd4e5f6g', short_hash: 'd4e5f6g', message: 'Phase 4 complete: Analytics Engine', author: 'Jeremy McSpadden', date: '2026-02-19T16:00:00', files_changed: 12, insertions: 856, deletions: 43 },
          { hash: 'e5f6g7h', short_hash: 'e5f6g7h', message: 'Add chart components with Recharts', author: 'Jeremy McSpadden', date: '2026-02-19T14:30:00', files_changed: 8, insertions: 423, deletions: 15 },
        ];
        case 'git_branches': return ['main', 'feature/billing', 'feature/analytics', 'fix/auth-redirect'];
        case 'git_tags': return ['v0.1.0', 'v0.2.0'];
        case 'git_remote_url': return 'https://github.com/fluxlabs/saas-dashboard.git';
        case 'gsd_get_roadmap_progress': return mockRoadmapProgress;
        case 'gsd_get_project_info': return {
          vision: 'Build a comprehensive analytics dashboard for SaaS businesses',
          milestone: 'v1.0 - Core Platform',
          version: '1.0',
          core_value: 'Real-time insights for data-driven decisions',
          current_focus: 'Real-time Updates via WebSocket',
          raw_content: '',
        };
        case 'gsd_get_state': return {
          current_position: { milestone: 'v1.0', phase: 'Phase 6', plan: 'Plan 6.1', status: 'in_progress', last_activity: '2026-02-20T14:30:00', progress: '72%' },
          decisions: ['Use Stripe for billing', 'WebSocket over SSE for real-time', 'PostgreSQL for analytics queries'],
          pending_todos: ['Add WebSocket support', 'Add caching layer'],
          session_continuity: null,
          velocity: { total_plans: 16, avg_duration: '45m', total_time: '12h', by_phase: [] },
          blockers: [],
        };
        case 'gsd_get_config': return { workflow_mode: 'gsd', model_profile: 'balanced', raw_json: null, depth: 'standard', parallelization: true, commit_docs: true, workflow_research: true, workflow_inspection: true, workflow_plan_verification: true };
        case 'gsd_list_requirements': return [
          { req_id: 'REQ-001', description: 'User authentication with OAuth2', category: 'auth', priority: 'high', status: 'complete', phase: 'Phase 3' },
          { req_id: 'REQ-002', description: 'Real-time analytics dashboard', category: 'analytics', priority: 'high', status: 'complete', phase: 'Phase 4' },
          { req_id: 'REQ-003', description: 'Stripe billing integration', category: 'billing', priority: 'high', status: 'complete', phase: 'Phase 5' },
          { req_id: 'REQ-004', description: 'WebSocket live updates', category: 'realtime', priority: 'medium', status: 'in_progress', phase: 'Phase 6' },
          { req_id: 'REQ-005', description: 'Performance optimization (sub-200ms)', category: 'performance', priority: 'medium', status: 'pending', phase: 'Phase 7' },
        ];
        case 'gsd_list_milestones': return [
          { name: 'v1.0 - Core Platform', version: '1.0', phase_start: 1, phase_end: 8, status: 'in_progress', completed_at: null },
          { name: 'v1.1 - Performance & Polish', version: '1.1', phase_start: 9, phase_end: 12, status: 'planned', completed_at: null },
          { name: 'v2.0 - Multi-Tenant', version: '2.0', phase_start: 13, phase_end: 18, status: 'planned', completed_at: null },
        ];
        case 'gsd_list_plans': return [
          { phase_number: 1, plan_number: 1, plan_type: 'implementation', group_number: 1, autonomous: true, objective: 'Set up project scaffolding with Next.js and TypeScript', task_count: 4, tasks: [{ name: 'Initialize Next.js project', task_type: 'code', files: ['package.json', 'next.config.js'] }, { name: 'Configure TypeScript', task_type: 'code', files: ['tsconfig.json'] }, { name: 'Set up Tailwind CSS', task_type: 'code', files: ['tailwind.config.ts'] }, { name: 'Add base layout components', task_type: 'code', files: ['src/app/layout.tsx'] }], files_modified: ['package.json', 'next.config.js', 'tsconfig.json'], source_file: '01-PLAN-1.md' },
          { phase_number: 2, plan_number: 1, plan_type: 'implementation', group_number: 1, autonomous: true, objective: 'Build dashboard core with data visualization', task_count: 5, tasks: [{ name: 'Create dashboard page layout', task_type: 'code', files: ['src/app/dashboard/page.tsx'] }, { name: 'Add chart components with Recharts', task_type: 'code', files: ['src/components/charts/'] }, { name: 'Build metrics cards', task_type: 'code', files: ['src/components/metrics/'] }, { name: 'Implement data fetching hooks', task_type: 'code', files: ['src/hooks/use-metrics.ts'] }, { name: 'Write dashboard tests', task_type: 'test', files: ['tests/dashboard.test.tsx'] }], files_modified: ['src/app/dashboard/page.tsx', 'src/components/charts/'], source_file: '02-PLAN-1.md' },
          { phase_number: 3, plan_number: 1, plan_type: 'implementation', group_number: 1, autonomous: true, objective: 'Implement user authentication with OAuth2', task_count: 4, tasks: [{ name: 'Set up NextAuth.js', task_type: 'code', files: ['src/lib/auth.ts'] }, { name: 'Create login/signup pages', task_type: 'code', files: ['src/app/auth/'] }, { name: 'Add auth middleware', task_type: 'code', files: ['src/middleware.ts'] }, { name: 'Write auth integration tests', task_type: 'test', files: ['tests/auth.test.ts'] }], files_modified: ['src/lib/auth.ts', 'src/middleware.ts'], source_file: '03-PLAN-1.md' },
          { phase_number: 4, plan_number: 1, plan_type: 'implementation', group_number: 1, autonomous: true, objective: 'Build analytics engine with aggregation pipeline', task_count: 4, tasks: [{ name: 'Create analytics data models', task_type: 'code', files: ['src/models/analytics.ts'] }, { name: 'Build aggregation pipeline', task_type: 'code', files: ['src/services/analytics.ts'] }, { name: 'Add caching layer', task_type: 'code', files: ['src/lib/cache.ts'] }, { name: 'Write analytics tests', task_type: 'test', files: ['tests/analytics.test.ts'] }], files_modified: ['src/models/analytics.ts', 'src/services/analytics.ts'], source_file: '04-PLAN-1.md' },
          { phase_number: 5, plan_number: 1, plan_type: 'implementation', group_number: 1, autonomous: true, objective: 'Integrate Stripe billing with subscription management', task_count: 4, tasks: [{ name: 'Set up Stripe SDK', task_type: 'code', files: ['src/lib/stripe.ts'] }, { name: 'Build checkout flow', task_type: 'code', files: ['src/app/billing/'] }, { name: 'Add webhook handler', task_type: 'code', files: ['src/app/api/webhooks/stripe/'] }, { name: 'Write billing tests', task_type: 'test', files: ['tests/billing.test.ts'] }], files_modified: ['src/lib/stripe.ts', 'src/app/billing/'], source_file: '05-PLAN-1.md' },
          { phase_number: 6, plan_number: 1, plan_type: 'implementation', group_number: 1, autonomous: true, objective: 'Set up WebSocket server and client connection', task_count: 3, tasks: [{ name: 'Configure WebSocket server', task_type: 'code', files: ['src/ws/server.ts'] }, { name: 'Add client connection manager', task_type: 'code', files: ['src/ws/client.ts'] }, { name: 'Write connection tests', task_type: 'test', files: ['tests/ws.test.ts'] }], files_modified: ['src/ws/server.ts', 'src/ws/client.ts'], source_file: '06-PLAN-1.md' },
        ];
        case 'gsd_list_summaries': return [
          { phase_number: 1, plan_number: 1, subsystem: 'scaffolding', tags: ['setup', 'config'], duration: '1h 20m', completed: '2026-01-20T11:20:00', accomplishments: ['Next.js 14 project initialized with App Router', 'TypeScript strict mode configured', 'Tailwind CSS with custom design tokens', 'Base layout with responsive sidebar'], decisions: [{ decision: 'Use App Router over Pages Router', rationale: 'Better server components support' }], files_created: ['next.config.js', 'tailwind.config.ts'], files_modified: ['package.json', 'tsconfig.json'], deviations: null, self_check: 'All tasks completed. Build passes.', source_file: '01-SUMMARY-1.md' },
          { phase_number: 2, plan_number: 1, subsystem: 'dashboard', tags: ['ui', 'charts', 'data'], duration: '3h 45m', completed: '2026-01-25T16:00:00', accomplishments: ['Dashboard page with responsive grid layout', 'Line, bar, and pie charts via Recharts', 'Real-time metrics cards with trend indicators', 'Server-side data fetching with caching'], decisions: [{ decision: 'Use Recharts over Chart.js', rationale: 'Better React integration and composability' }, { decision: 'Server components for initial data load', rationale: 'Faster TTFB and better SEO' }], files_created: ['src/app/dashboard/page.tsx', 'src/components/charts/line-chart.tsx'], files_modified: ['src/hooks/use-metrics.ts'], deviations: 'Added skeleton loading states not in original plan', self_check: 'All tests pass. Dashboard renders correctly.', source_file: '02-SUMMARY-1.md' },
          { phase_number: 3, plan_number: 1, subsystem: 'auth', tags: ['security', 'oauth'], duration: '2h 30m', completed: '2026-02-01T14:30:00', accomplishments: ['NextAuth.js with Google and GitHub providers', 'Protected routes via middleware', 'Session management with JWT', 'Login page with social auth buttons'], decisions: [{ decision: 'JWT over database sessions', rationale: 'Simpler infrastructure, good enough for MVP' }], files_created: ['src/lib/auth.ts', 'src/app/auth/login/page.tsx'], files_modified: ['src/middleware.ts'], deviations: null, self_check: 'Auth flow tested end-to-end.', source_file: '03-SUMMARY-1.md' },
          { phase_number: 4, plan_number: 1, subsystem: 'analytics', tags: ['backend', 'data'], duration: '4h 10m', completed: '2026-02-10T18:00:00', accomplishments: ['Analytics data models with Prisma', 'Aggregation pipeline for time-series data', 'Redis caching for expensive queries', 'Performance benchmarks under 200ms'], decisions: [{ decision: 'Redis for caching over in-memory', rationale: 'Survives restarts, shared across instances' }], files_created: ['src/models/analytics.ts', 'src/services/analytics.ts'], files_modified: ['src/lib/cache.ts', 'prisma/schema.prisma'], deviations: null, self_check: 'All queries under 200ms P95.', source_file: '04-SUMMARY-1.md' },
          { phase_number: 5, plan_number: 1, subsystem: 'billing', tags: ['payments', 'stripe'], duration: '3h 00m', completed: '2026-02-15T12:00:00', accomplishments: ['Stripe SDK integration with TypeScript types', 'Checkout flow with plan selection', 'Webhook handler for subscription events', 'Customer portal link generation'], decisions: [{ decision: 'Use Stripe for billing', rationale: 'Industry standard, excellent DX' }], files_created: ['src/lib/stripe.ts', 'src/app/api/webhooks/stripe/route.ts'], files_modified: ['src/app/billing/page.tsx'], deviations: null, self_check: 'Webhook signature verification working.', source_file: '05-SUMMARY-1.md' },
        ];
        case 'gsd_list_phase_research': return [
          { phase_number: 4, domain: 'Time-Series Analytics', confidence: '92%', summary: 'PostgreSQL window functions with materialized views for sub-200ms aggregation queries. Redis for hot path caching.', anti_patterns: ['Storing pre-computed aggregates that become stale', 'Using ORM for complex aggregation queries'], pitfalls: ['Time zone handling in aggregation boundaries', 'Memory pressure from large result sets'], raw_content: '# Phase 4 Research\\n\\n## Time-Series Analytics\\n\\nPostgreSQL is excellent for time-series with proper indexing...', source_file: '04-RESEARCH.md' },
          { phase_number: 6, domain: 'WebSocket Architecture', confidence: '88%', summary: 'Socket.io with Redis adapter for horizontal scaling. Heartbeat mechanism for connection health monitoring.', anti_patterns: ['Broadcasting to all clients without filtering', 'Storing WebSocket state in memory only'], pitfalls: ['Reconnection storms after server restart', 'Message ordering guarantees across nodes'], raw_content: '# Phase 6 Research\\n\\n## WebSocket Architecture\\n\\nSocket.io provides the best DX for real-time features...', source_file: '06-RESEARCH.md' },
        ];
        case 'gsd_list_milestone_audits': return [];
        case 'gsd_list_validations': return [
          { id: 'val-001', project_id: 'proj-001', phase_number: '5', test_framework: 'Vitest', quick_run_cmd: 'pnpm test', full_run_cmd: 'pnpm test:coverage', nyquist_rate: 'Every 30 minutes', task_map: [{ task_id: 'TASK-01', requirement: 'Stripe SDK initializes correctly', test_type: 'automated', status: 'pass' }, { task_id: 'TASK-02', requirement: 'Checkout session creates with correct line items', test_type: 'automated', status: 'pass' }, { task_id: 'TASK-03', requirement: 'Webhook verifies Stripe signature', test_type: 'automated', status: 'pass' }, { task_id: 'TASK-04', requirement: 'Subscription status updates on webhook', test_type: 'automated', status: 'pass' }, { task_id: 'TASK-05', requirement: 'Customer portal URL generates', test_type: 'automated', status: 'pass' }, { task_id: 'TASK-06', requirement: 'Failed payment triggers retry', test_type: 'automated', status: 'fail' }, { task_id: 'TASK-07', requirement: 'Billing page shows current plan', test_type: 'manual', status: 'pass' }, { task_id: 'TASK-08', requirement: 'Upgrade/downgrade flow works', test_type: 'manual', status: 'pending' }], manual_checks: ['Verify Stripe dashboard shows test transactions', 'Check email notifications for subscription changes', 'Test with expired card scenario'], wave_tracking: [{ wave_number: 1, task_ids: ['TASK-01', 'TASK-02', 'TASK-03'], status: 'complete', tests_passed: '3/3', issues: null }, { wave_number: 2, task_ids: ['TASK-04', 'TASK-05', 'TASK-06'], status: 'complete', tests_passed: '2/3', issues: 'TASK-06: Retry logic not triggering on 402 response' }, { wave_number: 3, task_ids: ['TASK-07', 'TASK-08'], status: 'in_progress', tests_passed: '1/2', issues: null }], raw_content: null, source_file: '05-VALIDATION.md' },
        ];
        case 'gsd_list_uat_results': return [
          { id: 'uat-001', project_id: 'proj-001', phase_number: '5', session_number: 2, status: 'complete', tests: [{ number: 1, test: 'User can view current subscription plan', expected: 'Plan name, price, and renewal date displayed', result: 'pass', notes: null }, { number: 2, test: 'User can initiate plan upgrade', expected: 'Stripe checkout opens with correct plan', result: 'pass', notes: null }, { number: 3, test: 'Payment success redirects to dashboard', expected: 'Dashboard shows updated plan', result: 'pass', notes: 'Slight delay before plan updates — acceptable' }, { number: 4, test: 'User can access customer portal', expected: 'Stripe portal opens in new tab', result: 'pass', notes: null }, { number: 5, test: 'Failed payment shows error message', expected: 'User-friendly error with retry option', result: 'issue', notes: 'Error message is too technical for end users' }, { number: 6, test: 'Subscription cancellation flow', expected: 'Confirmation dialog, then cancellation processed', result: 'pass', notes: null }, { number: 7, test: 'Invoice history displays correctly', expected: 'List of past invoices with download links', result: 'pass', notes: null }, { number: 8, test: 'Proration calculated on mid-cycle upgrade', expected: 'Prorated amount shown before confirmation', result: 'issue', notes: 'Proration amount not visible until Stripe checkout' }], issues: [{ severity: 'major', description: 'Failed payment error message shows raw Stripe error instead of user-friendly message' }, { severity: 'minor', description: 'Proration preview not shown before redirecting to Stripe checkout' }], gaps: ['Load testing with concurrent checkouts', 'Webhook retry scenario testing'], diagnosis: null, raw_content: null, source_file: '05-UAT-2.md', pass_count: 6, issue_count: 2, pending_count: 0 },
        ];
        case 'gsd_sync_project': return { todos_synced: 3, milestones_synced: 1, requirements_synced: 5, verifications_synced: 2, plans_synced: 6, summaries_synced: 5, phase_research_synced: 3, uat_synced: 0 };
        case 'gsd_list_debug_sessions': return [
          { id: 'dbg-001', title: 'Stripe webhook signature verification failing in staging', error_type: 'SecurityError', status: 'resolved', summary: 'Webhook secret was using test mode key in staging environment', resolution: 'Updated STRIPE_WEBHOOK_SECRET env var in staging to use the correct endpoint secret from Stripe dashboard', source_file: 'DEBUG-001.md', created_at: '2026-02-14T09:00:00', resolved_at: '2026-02-14T10:30:00' },
          { id: 'dbg-002', title: 'Dashboard charts not rendering on Safari 17', error_type: 'RenderError', status: 'resolved', summary: 'CSS container queries not fully supported in Safari 17.0', resolution: 'Added fallback CSS using @supports and polyfill for container queries', source_file: 'DEBUG-002.md', created_at: '2026-02-08T14:00:00', resolved_at: '2026-02-08T16:45:00' },
          { id: 'dbg-003', title: 'API response timeout on analytics aggregation endpoint', error_type: 'TimeoutError', status: 'active', summary: 'The /api/analytics/aggregate endpoint times out when querying more than 90 days of data', resolution: null, source_file: 'DEBUG-003.md', created_at: '2026-02-19T11:00:00', resolved_at: null },
        ];
        case 'gsd_list_research': return [];
        case 'gsd_get_phase_context': return {
          decisions: ['Use Next.js App Router for server components', 'PostgreSQL with Prisma ORM', 'Stripe for billing integration', 'Redis for caching layer', 'WebSocket over SSE for real-time updates'],
          deferred_ideas: ['Mobile app (React Native)', 'Multi-tenant architecture', 'Custom analytics dashboard builder', 'AI-powered insights engine'],
          raw_content: '# Phase Context\\n\\n## Decisions\\n- Use Next.js App Router\\n- PostgreSQL with Prisma\\n\\n## Deferred\\n- Mobile app\\n- Multi-tenant',
        };
        case 'read_project_docs': return { description: 'Full-stack analytics dashboard', goal: 'Build a production-ready SaaS analytics platform', source: 'PROJECT.md' };
        case 'detect_tech_stack': return mockProjects[0].tech_stack;
        case 'toggle_favorite': return true;
        case 'list_knowledge_files': return { folders: [
          { name: '.planning', display_name: 'Planning', files: [
            { relative_path: '.planning/PROJECT.md', display_name: 'PROJECT.md', folder: '.planning', size_bytes: 3200 },
            { relative_path: '.planning/ROADMAP.md', display_name: 'ROADMAP.md', folder: '.planning', size_bytes: 4800 },
            { relative_path: '.planning/DECISIONS.md', display_name: 'DECISIONS.md', folder: '.planning', size_bytes: 2100 },
            { relative_path: '.planning/TODOS.md', display_name: 'TODOS.md', folder: '.planning', size_bytes: 1500 },
          ]},
          { name: 'docs', display_name: 'Docs', files: [
            { relative_path: 'docs/ARCHITECTURE.md', display_name: 'ARCHITECTURE.md', folder: 'docs', size_bytes: 6400 },
            { relative_path: 'docs/API.md', display_name: 'API.md', folder: 'docs', size_bytes: 8200 },
            { relative_path: 'docs/DEPLOYMENT.md', display_name: 'DEPLOYMENT.md', folder: 'docs', size_bytes: 3100 },
          ]},
        ], total_files: 7 };
        case 'list_code_files': return { folders: [
          { name: 'src', display_name: 'src', files: [
            { relative_path: 'src/app/layout.tsx', display_name: 'layout.tsx', folder: 'src', size_bytes: 1200 },
            { relative_path: 'src/app/page.tsx', display_name: 'page.tsx', folder: 'src', size_bytes: 2400 },
            { relative_path: 'src/app/dashboard/page.tsx', display_name: 'dashboard/page.tsx', folder: 'src', size_bytes: 4800 },
            { relative_path: 'src/lib/auth.ts', display_name: 'lib/auth.ts', folder: 'src', size_bytes: 1800 },
            { relative_path: 'src/lib/stripe.ts', display_name: 'lib/stripe.ts', folder: 'src', size_bytes: 2200 },
          ]},
          { name: 'tests', display_name: 'tests', files: [
            { relative_path: 'tests/dashboard.test.tsx', display_name: 'dashboard.test.tsx', folder: 'tests', size_bytes: 3200 },
            { relative_path: 'tests/auth.test.ts', display_name: 'auth.test.ts', folder: 'tests', size_bytes: 2800 },
            { relative_path: 'tests/billing.test.ts', display_name: 'billing.test.ts', folder: 'tests', size_bytes: 3600 },
          ]},
        ], total_files: 8 };
        case 'search_knowledge_files': return [];
        case 'get_scanner_summary': return { available: false, overall_grade: null, scan_date: null, categories: [], reports: [], total_gaps: null, total_recommendations: null, overall_score: null, analysis_mode: null, project_phase: null, high_priority_actions: [], source: null };
        case 'get_dependency_status': return { package_manager: 'pnpm', outdated_count: 8, vulnerable_count: 2, details: { outdated: { react: { current: '18.2.0', wanted: '18.3.1', latest: '19.0.0' }, typescript: { current: '5.3.3', wanted: '5.4.5', latest: '5.6.2' }, next: { current: '14.1.0', wanted: '14.2.3', latest: '15.0.0' }, prisma: { current: '5.8.1', wanted: '5.10.2', latest: '5.10.2' }, tailwindcss: { current: '3.4.0', wanted: '3.4.4', latest: '4.0.0' }, recharts: { current: '2.10.3', wanted: '2.12.0', latest: '2.12.0' }, '@stripe/stripe-js': { current: '2.4.0', wanted: '2.5.0', latest: '3.0.0' }, 'socket.io': { current: '4.7.2', wanted: '4.7.5', latest: '4.7.5' } }, audit: { 'lodash.merge': { severity: 'high', title: 'Prototype Pollution', url: 'https://github.com/advisories/GHSA-1234' }, 'semver': { severity: 'moderate', title: 'ReDoS vulnerability', url: 'https://github.com/advisories/GHSA-5678' } } }, checked_at: '2026-02-20T14:00:00' };
        case 'watch_project_files': return true;
        case 'unwatch_project_files': return true;
        case 'list_knowledge_bookmarks': return [];
        case 'build_knowledge_graph': return { nodes: [], edges: [] };
        case 'global_search': return { projects: [], phases: [], decisions: [], knowledge: [] };
        case 'can_safely_close': return { can_close: true, active_terminals: 0 };
        case 'get_command_history': return [];
        case 'list_snippets': return [];
        case 'list_auto_commands': return [];
        case 'get_auto_command_presets': return [];
        case 'get_script_favorites': return [];
        case 'restore_terminal_sessions': return [];
        case 'pty_check_tmux': return null;
        case 'pty_list_tmux': return [];
        case 'get_environment_info': return { git_branch: 'main', node_version: 'v22.4.0', python_version: '3.12.1', rust_version: '1.82.0', working_directory: '/Users/dev/projects' };
        case 'list_secret_keys': return ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'STRIPE_SECRET_KEY'];
        case 'get_predefined_secret_keys': return ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'STRIPE_SECRET_KEY', 'DATABASE_URL'];
        case 'has_secret': return true;
        default:
          console.warn('[MOCK] Unhandled command:', cmd, args);
          return null;
      }
    }

    window.__TAURI_INTERNALS__.invoke = invoke;
    window.__TAURI_INTERNALS__.transformCallback = registerCallback;
    window.__TAURI_INTERNALS__.unregisterCallback = unregisterCallback;
    window.__TAURI_INTERNALS__.runCallback = runCallback;
    window.__TAURI_INTERNALS__.callbacks = callbacks;
    window.__TAURI_INTERNALS__.metadata = {
      currentWindow: { label: 'main' },
      currentWebview: { windowLabel: 'main', label: 'main' },
    };
    window.__TAURI_INTERNALS__.convertFileSrc = function(filePath, protocol) {
      return 'asset://localhost/' + encodeURIComponent(filePath);
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener = function() {};

    console.log('[MOCK] Tauri IPC mocked successfully');
  `;
}

test.describe('Website Screenshots', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });

  test.beforeEach(async ({ page }) => {
    // Inject mocks before any page navigation
    await page.addInitScript({ content: buildMockScript() });
  });

  test('Dashboard - main view', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'dashboard.png'),
      fullPage: false,
    });
  });

  test('Projects - grid view', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'projects.png'),
      fullPage: false,
    });
  });

  test('Project Detail - overview', async ({ page }) => {
    await page.goto('/projects/proj-001');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'project-detail.png'),
      fullPage: false,
    });
  });

  test('Todos - cross-project view', async ({ page }) => {
    await page.goto('/todos');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'todos.png'),
      fullPage: false,
    });
  });

  test('Settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'settings.png'),
      fullPage: false,
    });
  });

  test('Notifications page', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'notifications.png'),
      fullPage: false,
    });
  });

  test('Logs page', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'logs.png'),
      fullPage: false,
    });
  });

  test('Terminal page', async ({ page }) => {
    await page.goto('/terminal');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'terminal.png'),
      fullPage: false,
    });
  });

  // Project sub-tabs
  test('Project Detail - Knowledge tab', async ({ page }) => {
    await page.goto('/projects/proj-001?tab=knowledge');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'project-knowledge.png'),
      fullPage: false,
    });
  });

  test('Project Detail - Project tab (Files)', async ({ page }) => {
    await page.goto('/projects/proj-001?tab=project');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'project-files.png'),
      fullPage: false,
    });
  });

  // GSD sub-tabs
  test('Project Detail - GSD Plans', async ({ page }) => {
    await page.goto('/projects/proj-001?tab=gsd');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gsd-plans.png'),
      fullPage: false,
    });
  });

  test('Project Detail - GSD Context', async ({ page }) => {
    await page.goto('/projects/proj-001?tab=gsd');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Click the Context sub-tab
    const contextTab = page.locator('button', { hasText: 'Context' });
    if (await contextTab.count() > 0) {
      await contextTab.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gsd-context.png'),
      fullPage: false,
    });
  });

  test('Project Detail - GSD Todos', async ({ page }) => {
    await page.goto('/projects/proj-001?tab=gsd');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const todosTab = page.getByLabel('GSD').getByRole('button', { name: 'Todos' });
    if (await todosTab.count() > 0) {
      await todosTab.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gsd-todos.png'),
      fullPage: false,
    });
  });

  test('Project Detail - GSD Validation', async ({ page }) => {
    await page.goto('/projects/proj-001?tab=gsd');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const validationTab = page.locator('button', { hasText: 'Validation' });
    if (await validationTab.count() > 0) {
      await validationTab.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gsd-validation.png'),
      fullPage: false,
    });
  });

  test('Project Detail - GSD UAT', async ({ page }) => {
    await page.goto('/projects/proj-001?tab=gsd');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const uatTab = page.locator('button', { hasText: 'UAT' });
    if (await uatTab.count() > 0) {
      await uatTab.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gsd-uat.png'),
      fullPage: false,
    });
  });

  test('Project Detail - GSD Milestones', async ({ page }) => {
    await page.goto('/projects/proj-001?tab=gsd');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const milestonesTab = page.locator('button', { hasText: 'Milestones' });
    if (await milestonesTab.count() > 0) {
      await milestonesTab.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gsd-milestones.png'),
      fullPage: false,
    });
  });

  test('Project Detail - GSD Debug', async ({ page }) => {
    await page.goto('/projects/proj-001?tab=gsd');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const debugTab = page.locator('button', { hasText: 'Debug' });
    if (await debugTab.count() > 0) {
      await debugTab.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gsd-debug.png'),
      fullPage: false,
    });
  });
});
