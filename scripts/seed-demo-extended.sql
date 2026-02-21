-- Control Tower - Extended Demo Data (12 Additional Projects)
-- Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
-- Usage: sqlite3 "$DB_PATH" < scripts/seed-demo-extended.sql

-- ============================================================================
-- PROJECTS (12 new)
-- ============================================================================

INSERT OR IGNORE INTO projects (id, name, path, description, tech_stack, config, status, is_favorite, created_at, updated_at) VALUES
  ('proj-04', 'E-Commerce Platform', '/Users/demo/projects/ecommerce', 'Full-stack e-commerce with product catalog, cart, checkout, and order management.', '{"languages":["TypeScript"],"frameworks":["Next.js","Prisma","Stripe"],"has_autopilot":true,"has_planning":true}', '{"model_profile":"quality"}', 'active', 1, datetime('now','-30 days'), datetime('now','-2 hours')),
  ('proj-05', 'DevOps Dashboard', '/Users/demo/projects/devops-dash', 'Internal monitoring tool for CI/CD pipelines, deployments, and infrastructure health.', '{"languages":["Go","TypeScript"],"frameworks":["Fiber","React","Prometheus"],"has_planning":true}', '{}', 'active', 0, datetime('now','-25 days'), datetime('now','-5 hours')),
  ('proj-06', 'Social Analytics Engine', '/Users/demo/projects/social-analytics', 'Real-time social media analytics with sentiment analysis and trend detection.', '{"languages":["Python","TypeScript"],"frameworks":["FastAPI","React","Redis"],"has_autopilot":true}', '{"model_profile":"balanced"}', 'active', 1, datetime('now','-45 days'), datetime('now','-1 hour')),
  ('proj-07', 'Real-time Chat', '/Users/demo/projects/realtime-chat', 'Scalable chat application with channels, threads, presence, and file sharing.', '{"languages":["Elixir","TypeScript"],"frameworks":["Phoenix","React"]}', '{}', 'active', 0, datetime('now','-18 days'), datetime('now','-8 hours')),
  ('proj-08', 'CMS Platform', '/Users/demo/projects/cms-platform', 'Headless CMS with visual page builder, asset management, and multi-tenant support.', '{"languages":["PHP","TypeScript"],"frameworks":["Laravel","Vue.js","Inertia"],"has_planning":true}', '{}', 'active', 0, datetime('now','-35 days'), datetime('now','-12 hours')),
  ('proj-09', 'ML Pipeline', '/Users/demo/projects/ml-pipeline', 'End-to-end machine learning pipeline for training, evaluation, and model serving.', '{"languages":["Python","Rust"],"frameworks":["PyTorch","FastAPI","Airflow"],"has_autopilot":true,"has_planning":true}', '{"model_profile":"quality"}', 'active', 1, datetime('now','-40 days'), datetime('now','-3 hours')),
  ('proj-10', 'IoT Sensor Hub', '/Users/demo/projects/iot-sensors', 'High-throughput IoT data ingestion with MQTT broker, time-series storage, and alerting.', '{"languages":["Rust","TypeScript"],"frameworks":["Axum","MQTT","TimescaleDB"],"has_autopilot":true}', '{}', 'active', 0, datetime('now','-15 days'), datetime('now','-10 hours')),
  ('proj-11', 'HR Management Portal', '/Users/demo/projects/hr-portal', 'Employee management system with payroll, leave tracking, and performance reviews.', '{"languages":["Ruby","TypeScript"],"frameworks":["Rails","React"]}', '{}', 'archived', 0, datetime('now','-60 days'), datetime('now','-20 days')),
  ('proj-12', 'Video Streaming Service', '/Users/demo/projects/video-stream', 'Adaptive bitrate video streaming with transcoding pipeline and CDN integration.', '{"languages":["TypeScript","Go"],"frameworks":["Node.js","FFmpeg","HLS"],"has_planning":true}', '{}', 'active', 0, datetime('now','-22 days'), datetime('now','-6 hours')),
  ('proj-13', 'Crypto Trading Bot', '/Users/demo/projects/crypto-bot', 'Algorithmic trading bot with strategy backtesting, live execution, and portfolio tracking.', '{"languages":["Python","TypeScript"],"frameworks":["ccxt","FastAPI","PostgreSQL"],"has_autopilot":true}', '{"model_profile":"quality"}', 'active', 1, datetime('now','-28 days'), datetime('now','-1 hour')),
  ('proj-14', 'Fitness Tracker', '/Users/demo/projects/fitness-app', 'Cross-platform fitness app with workout plans, progress tracking, and social features.', '{"languages":["Dart","TypeScript"],"frameworks":["Flutter","Firebase","GraphQL"],"has_autopilot":true,"has_planning":true}', '{"model_profile":"balanced"}', 'active', 0, datetime('now','-20 days'), datetime('now','-4 hours')),
  ('proj-15', 'Doc Collaboration', '/Users/demo/projects/doc-collab', 'Real-time collaborative document editor with CRDT-based conflict resolution and comments.', '{"languages":["TypeScript","Rust"],"frameworks":["React","Y.js","WebRTC"]}', '{}', 'active', 0, datetime('now','-12 days'), datetime('now','-7 hours'));

-- ============================================================================
-- FLIGHT PLANS (12 new)
-- ============================================================================

INSERT OR IGNORE INTO flight_plans (id, project_id, name, description, total_phases, completed_phases, total_tasks, completed_tasks, estimated_cost, actual_cost, status, created_at, updated_at) VALUES
  ('fp-04', 'proj-04', 'v1.0 Storefront Launch', 'Complete e-commerce storefront with payments and order fulfillment.', 4, 3, 12, 10, 55.00, 42.30, 'in_progress', datetime('now','-30 days'), datetime('now','-2 hours')),
  ('fp-05', 'proj-05', 'Internal Beta', 'Pipeline monitoring dashboard for the engineering team.', 3, 2, 9, 7, 30.00, 22.10, 'in_progress', datetime('now','-25 days'), datetime('now','-5 hours')),
  ('fp-06', 'proj-06', 'v2.0 Analytics Overhaul', 'Rebuild analytics engine with real-time streaming and ML-based sentiment.', 4, 4, 12, 12, 60.00, 52.80, 'completed', datetime('now','-45 days'), datetime('now','-1 hour')),
  ('fp-07', 'proj-07', 'MVP Release', 'Core chat with channels, DMs, and basic file sharing.', 3, 1, 9, 4, 35.00, 12.50, 'in_progress', datetime('now','-18 days'), datetime('now','-8 hours')),
  ('fp-08', 'proj-08', 'v3.0 Page Builder', 'Visual drag-and-drop page builder with component library.', 4, 2, 12, 7, 48.00, 28.60, 'in_progress', datetime('now','-35 days'), datetime('now','-12 hours')),
  ('fp-09', 'proj-09', 'Training Pipeline v1', 'Automated model training, validation, and deployment pipeline.', 4, 3, 12, 9, 65.00, 48.90, 'in_progress', datetime('now','-40 days'), datetime('now','-3 hours')),
  ('fp-10', 'proj-10', 'Sensor Platform MVP', 'MQTT ingestion, time-series storage, and basic alerting.', 3, 1, 9, 3, 28.00, 8.40, 'in_progress', datetime('now','-15 days'), datetime('now','-10 hours')),
  ('fp-11', 'proj-11', 'v2.0 Complete', 'Full HR portal with payroll integration and review cycles.', 3, 3, 9, 9, 40.00, 38.50, 'completed', datetime('now','-60 days'), datetime('now','-20 days')),
  ('fp-12', 'proj-12', 'Streaming MVP', 'Video upload, transcoding, and adaptive playback.', 3, 1, 9, 4, 42.00, 15.80, 'in_progress', datetime('now','-22 days'), datetime('now','-6 hours')),
  ('fp-13', 'proj-13', 'Trading Engine v1', 'Strategy framework, backtesting, and live paper trading.', 4, 2, 12, 7, 50.00, 28.40, 'in_progress', datetime('now','-28 days'), datetime('now','-1 hour')),
  ('fp-14', 'proj-14', 'v1.0 App Launch', 'Core fitness tracking with workouts, progress, and social feed.', 3, 2, 9, 6, 38.00, 24.60, 'in_progress', datetime('now','-20 days'), datetime('now','-4 hours')),
  ('fp-15', 'proj-15', 'Editor Core', 'CRDT document model, real-time sync, and collaborative cursors.', 3, 0, 9, 2, 45.00, 8.20, 'in_progress', datetime('now','-12 days'), datetime('now','-7 hours'));

-- ============================================================================
-- PHASES
-- ============================================================================

-- proj-04 E-Commerce (4 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-04-1', 'fp-04', 1, 'Product Catalog', 'Product models, categories, search, and image handling.', 'Browsable product catalog with search', 'completed', 3, 3, 12.00, 10.50, 0, datetime('now','-30 days'), datetime('now','-26 days'), datetime('now','-30 days')),
  ('ph-04-2', 'fp-04', 2, 'Cart & Checkout', 'Shopping cart, address forms, and Stripe payment flow.', 'End-to-end purchase flow', 'completed', 3, 3, 15.00, 13.20, 1, datetime('now','-25 days'), datetime('now','-20 days'), datetime('now','-25 days')),
  ('ph-04-3', 'fp-04', 3, 'Order Management', 'Order tracking, email notifications, and admin dashboard.', 'Complete order lifecycle management', 'completed', 3, 3, 14.00, 11.80, 2, datetime('now','-19 days'), datetime('now','-14 days'), datetime('now','-19 days')),
  ('ph-04-4', 'fp-04', 4, 'Reviews & Recommendations', 'Product reviews, ratings, and ML-based recommendations.', 'Social proof and personalized shopping', 'in_progress', 3, 1, 14.00, 6.80, 3, datetime('now','-10 days'), NULL, datetime('now','-10 days'));

-- proj-05 DevOps Dashboard (3 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-05-1', 'fp-05', 1, 'Data Collection', 'Prometheus scraping, GitHub webhook ingestion, pipeline event parsing.', 'Unified data layer for CI/CD metrics', 'completed', 3, 3, 10.00, 8.20, 0, datetime('now','-25 days'), datetime('now','-20 days'), datetime('now','-25 days')),
  ('ph-05-2', 'fp-05', 2, 'Dashboard UI', 'React dashboard with pipeline status, deploy history, and alerts.', 'Interactive monitoring interface', 'completed', 3, 3, 12.00, 9.40, 1, datetime('now','-19 days'), datetime('now','-14 days'), datetime('now','-19 days')),
  ('ph-05-3', 'fp-05', 3, 'Alerting & Integrations', 'Slack/PagerDuty alerts, custom thresholds, and incident tracking.', 'Proactive issue detection', 'in_progress', 3, 1, 8.00, 4.50, 2, datetime('now','-12 days'), NULL, datetime('now','-12 days'));

-- proj-06 Social Analytics (4 phases, all completed)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-06-1', 'fp-06', 1, 'Data Ingestion', 'Twitter/Reddit/HN API connectors with rate limiting and deduplication.', 'Reliable multi-source data collection', 'completed', 3, 3, 14.00, 12.50, 0, datetime('now','-45 days'), datetime('now','-40 days'), datetime('now','-45 days')),
  ('ph-06-2', 'fp-06', 2, 'Sentiment Analysis', 'NLP pipeline with fine-tuned transformer model for sentiment scoring.', 'Accurate real-time sentiment classification', 'completed', 3, 3, 18.00, 16.30, 1, datetime('now','-39 days'), datetime('now','-32 days'), datetime('now','-39 days')),
  ('ph-06-3', 'fp-06', 3, 'Trend Detection', 'Time-series analysis for emerging topics and viral content detection.', 'Early trend identification system', 'completed', 3, 3, 15.00, 13.00, 2, datetime('now','-31 days'), datetime('now','-24 days'), datetime('now','-31 days')),
  ('ph-06-4', 'fp-06', 4, 'Dashboard & Reports', 'Interactive charts, scheduled PDF reports, and webhook notifications.', 'Actionable analytics presentation layer', 'completed', 3, 3, 13.00, 11.00, 3, datetime('now','-23 days'), datetime('now','-16 days'), datetime('now','-23 days'));

-- proj-07 Real-time Chat (3 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-07-1', 'fp-07', 1, 'Core Messaging', 'Phoenix Channels for real-time messaging with presence tracking.', 'Reliable real-time message delivery', 'completed', 3, 3, 12.00, 8.50, 0, datetime('now','-18 days'), datetime('now','-13 days'), datetime('now','-18 days')),
  ('ph-07-2', 'fp-07', 2, 'Channels & Threads', 'Public/private channels, threaded replies, and message search.', 'Organized conversation structure', 'in_progress', 3, 1, 13.00, 4.00, 1, datetime('now','-12 days'), NULL, datetime('now','-12 days')),
  ('ph-07-3', 'fp-07', 3, 'File Sharing & Reactions', 'File uploads, image previews, emoji reactions, and read receipts.', 'Rich messaging experience', 'pending', 3, 0, 10.00, NULL, 2, NULL, NULL, datetime('now','-12 days'));

-- proj-08 CMS Platform (4 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-08-1', 'fp-08', 1, 'Content Models', 'Dynamic content types, fields, validation rules, and relationships.', 'Flexible content modeling system', 'completed', 3, 3, 12.00, 10.20, 0, datetime('now','-35 days'), datetime('now','-30 days'), datetime('now','-35 days')),
  ('ph-08-2', 'fp-08', 2, 'Page Builder', 'Drag-and-drop editor with component library and responsive preview.', 'Visual page composition tool', 'completed', 3, 3, 15.00, 12.40, 1, datetime('now','-29 days'), datetime('now','-22 days'), datetime('now','-29 days')),
  ('ph-08-3', 'fp-08', 3, 'Asset Management', 'Image/video uploads, CDN integration, and automatic optimization.', 'Centralized media library', 'in_progress', 3, 1, 11.00, 3.50, 2, datetime('now','-18 days'), NULL, datetime('now','-18 days')),
  ('ph-08-4', 'fp-08', 4, 'Multi-tenancy', 'Tenant isolation, custom domains, and per-tenant billing.', 'SaaS-ready multi-tenant architecture', 'pending', 3, 0, 10.00, NULL, 3, NULL, NULL, datetime('now','-18 days'));

-- proj-09 ML Pipeline (4 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-09-1', 'fp-09', 1, 'Data Processing', 'ETL pipeline with data validation, feature engineering, and versioning.', 'Reproducible data preparation pipeline', 'completed', 3, 3, 16.00, 14.20, 0, datetime('now','-40 days'), datetime('now','-34 days'), datetime('now','-40 days')),
  ('ph-09-2', 'fp-09', 2, 'Model Training', 'Distributed training with hyperparameter tuning and experiment tracking.', 'Automated model training with MLflow tracking', 'completed', 3, 3, 20.00, 17.50, 1, datetime('now','-33 days'), datetime('now','-26 days'), datetime('now','-33 days')),
  ('ph-09-3', 'fp-09', 3, 'Model Serving', 'FastAPI model server with batching, caching, and A/B testing.', 'Low-latency inference API', 'completed', 3, 3, 15.00, 12.20, 2, datetime('now','-25 days'), datetime('now','-18 days'), datetime('now','-25 days')),
  ('ph-09-4', 'fp-09', 4, 'Monitoring & Drift', 'Data drift detection, model performance tracking, and auto-retraining.', 'Automated model health monitoring', 'in_progress', 3, 0, 14.00, 5.00, 3, datetime('now','-14 days'), NULL, datetime('now','-14 days'));

-- proj-10 IoT Sensor Hub (3 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-10-1', 'fp-10', 1, 'MQTT Broker', 'Custom MQTT broker with authentication, QoS levels, and topic routing.', 'Reliable message broker for IoT devices', 'completed', 3, 3, 10.00, 8.40, 0, datetime('now','-15 days'), datetime('now','-10 days'), datetime('now','-15 days')),
  ('ph-10-2', 'fp-10', 2, 'Time-Series Storage', 'TimescaleDB schema, continuous aggregates, and retention policies.', 'Efficient sensor data storage and querying', 'in_progress', 3, 0, 10.00, 0.00, 1, datetime('now','-9 days'), NULL, datetime('now','-9 days')),
  ('ph-10-3', 'fp-10', 3, 'Alerting Dashboard', 'Threshold alerts, anomaly detection, and Grafana integration.', 'Real-time sensor monitoring', 'pending', 3, 0, 8.00, NULL, 2, NULL, NULL, datetime('now','-9 days'));

-- proj-11 HR Management (3 phases, all completed, archived)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-11-1', 'fp-11', 1, 'Employee Directory', 'Employee profiles, org chart, and search with department filters.', 'Centralized employee information', 'completed', 3, 3, 12.00, 11.50, 0, datetime('now','-60 days'), datetime('now','-52 days'), datetime('now','-60 days')),
  ('ph-11-2', 'fp-11', 2, 'Leave & Attendance', 'Leave requests, approval workflows, and attendance tracking.', 'Automated leave management', 'completed', 3, 3, 14.00, 13.80, 1, datetime('now','-51 days'), datetime('now','-42 days'), datetime('now','-51 days')),
  ('ph-11-3', 'fp-11', 3, 'Performance Reviews', 'Review cycles, 360 feedback, and goal tracking dashboards.', 'Structured performance evaluation system', 'completed', 3, 3, 14.00, 13.20, 2, datetime('now','-41 days'), datetime('now','-32 days'), datetime('now','-41 days'));

-- proj-12 Video Streaming (3 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-12-1', 'fp-12', 1, 'Transcoding Pipeline', 'FFmpeg-based transcoding with HLS output and thumbnail generation.', 'Automated video processing pipeline', 'completed', 3, 3, 16.00, 12.80, 0, datetime('now','-22 days'), datetime('now','-16 days'), datetime('now','-22 days')),
  ('ph-12-2', 'fp-12', 2, 'Playback & CDN', 'Adaptive bitrate player, CDN integration, and DRM protection.', 'Smooth video playback experience', 'in_progress', 3, 1, 14.00, 3.00, 1, datetime('now','-15 days'), NULL, datetime('now','-15 days')),
  ('ph-12-3', 'fp-12', 3, 'Creator Dashboard', 'Upload interface, analytics, and channel management.', 'Content creator management tools', 'pending', 3, 0, 12.00, NULL, 2, NULL, NULL, datetime('now','-15 days'));

-- proj-13 Crypto Trading Bot (4 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-13-1', 'fp-13', 1, 'Exchange Connectors', 'Unified API for Binance, Coinbase, and Kraken with WebSocket feeds.', 'Multi-exchange data and order connectivity', 'completed', 3, 3, 12.00, 10.40, 0, datetime('now','-28 days'), datetime('now','-22 days'), datetime('now','-28 days')),
  ('ph-13-2', 'fp-13', 2, 'Strategy Framework', 'Backtesting engine, strategy DSL, and performance analytics.', 'Reproducible strategy evaluation system', 'completed', 3, 3, 15.00, 12.00, 1, datetime('now','-21 days'), datetime('now','-14 days'), datetime('now','-21 days')),
  ('ph-13-3', 'fp-13', 3, 'Live Trading', 'Paper trading, risk management, and position sizing.', 'Safe live execution with guardrails', 'in_progress', 3, 1, 13.00, 4.00, 2, datetime('now','-13 days'), NULL, datetime('now','-13 days')),
  ('ph-13-4', 'fp-13', 4, 'Portfolio Dashboard', 'P&L tracking, trade journal, and tax reporting.', 'Comprehensive portfolio visibility', 'pending', 3, 0, 10.00, NULL, 3, NULL, NULL, datetime('now','-13 days'));

-- proj-14 Fitness Tracker (3 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-14-1', 'fp-14', 1, 'Workout Engine', 'Exercise library, workout builder, and timer/rep tracking.', 'Core workout tracking functionality', 'completed', 3, 3, 12.00, 10.20, 0, datetime('now','-20 days'), datetime('now','-14 days'), datetime('now','-20 days')),
  ('ph-14-2', 'fp-14', 2, 'Progress & Analytics', 'Body metrics, strength progression charts, and personal records.', 'Visual fitness progress tracking', 'completed', 3, 3, 14.00, 11.40, 1, datetime('now','-13 days'), datetime('now','-7 days'), datetime('now','-13 days')),
  ('ph-14-3', 'fp-14', 3, 'Social & Gamification', 'Activity feed, challenges, achievements, and friend leaderboards.', 'Social motivation features', 'in_progress', 3, 0, 12.00, 3.00, 2, datetime('now','-6 days'), NULL, datetime('now','-6 days'));

-- proj-15 Doc Collaboration (3 phases)
INSERT OR IGNORE INTO phases (id, flight_plan_id, phase_number, name, description, goal, status, total_tasks, completed_tasks, estimated_cost, actual_cost, order_index, started_at, completed_at, created_at) VALUES
  ('ph-15-1', 'fp-15', 1, 'CRDT Document Model', 'Y.js-based document model with rich text, tables, and embeds.', 'Conflict-free collaborative data structure', 'in_progress', 3, 2, 18.00, 8.20, 0, datetime('now','-12 days'), NULL, datetime('now','-12 days')),
  ('ph-15-2', 'fp-15', 2, 'Real-time Sync', 'WebRTC peer connections with signaling server and awareness protocol.', 'Low-latency collaborative editing', 'pending', 3, 0, 15.00, NULL, 1, NULL, NULL, datetime('now','-12 days')),
  ('ph-15-3', 'fp-15', 3, 'Comments & History', 'Inline comments, version history, and document snapshots.', 'Review and audit trail', 'pending', 3, 0, 12.00, NULL, 2, NULL, NULL, datetime('now','-12 days'));

-- ============================================================================
-- TASKS
-- ============================================================================

-- proj-04 E-Commerce
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-04-1a', 'ph-04-1', '1.1', 'Product schema & CRUD API', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-30 days'), datetime('now','-29 days'), datetime('now','-30 days')),
  ('t-04-1b', 'ph-04-1', '1.2', 'Category tree & faceted search', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-29 days'), datetime('now','-27 days'), datetime('now','-30 days')),
  ('t-04-1c', 'ph-04-1', '1.3', 'Image upload & optimization', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-27 days'), datetime('now','-26 days'), datetime('now','-30 days')),
  ('t-04-2a', 'ph-04-2', '2.1', 'Cart state management', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-25 days'), datetime('now','-23 days'), datetime('now','-25 days')),
  ('t-04-2b', 'ph-04-2', '2.2', 'Stripe checkout integration', 'completed', 'sentinel', 'claude-opus-4-6', 1, datetime('now','-23 days'), datetime('now','-21 days'), datetime('now','-25 days')),
  ('t-04-2c', 'ph-04-2', '2.3', 'Address & shipping forms', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-21 days'), datetime('now','-20 days'), datetime('now','-25 days')),
  ('t-04-3a', 'ph-04-3', '3.1', 'Order lifecycle & status tracking', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-19 days'), datetime('now','-17 days'), datetime('now','-19 days')),
  ('t-04-3b', 'ph-04-3', '3.2', 'Transactional email notifications', 'completed', 'comms', 'claude-sonnet-4-5-20250929', 1, datetime('now','-17 days'), datetime('now','-15 days'), datetime('now','-19 days')),
  ('t-04-3c', 'ph-04-3', '3.3', 'Admin order dashboard', 'completed', 'engineering', 'claude-opus-4-6', 2, datetime('now','-15 days'), datetime('now','-14 days'), datetime('now','-19 days')),
  ('t-04-4a', 'ph-04-4', '4.1', 'Review & rating system', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-10 days'), datetime('now','-8 days'), datetime('now','-10 days')),
  ('t-04-4b', 'ph-04-4', '4.2', 'Collaborative filtering engine', 'in_progress', 'engineering', 'claude-opus-4-6', 1, datetime('now','-7 days'), NULL, datetime('now','-10 days')),
  ('t-04-4c', 'ph-04-4', '4.3', 'Recommendation widgets', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-10 days'));

-- proj-05 DevOps Dashboard
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-05-1a', 'ph-05-1', '1.1', 'Prometheus metrics scraper', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-25 days'), datetime('now','-23 days'), datetime('now','-25 days')),
  ('t-05-1b', 'ph-05-1', '1.2', 'GitHub webhook processor', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-23 days'), datetime('now','-21 days'), datetime('now','-25 days')),
  ('t-05-1c', 'ph-05-1', '1.3', 'Pipeline event normalizer', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-21 days'), datetime('now','-20 days'), datetime('now','-25 days')),
  ('t-05-2a', 'ph-05-2', '2.1', 'Pipeline status cards', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-19 days'), datetime('now','-17 days'), datetime('now','-19 days')),
  ('t-05-2b', 'ph-05-2', '2.2', 'Deploy history timeline', 'completed', 'engineering', 'claude-opus-4-6', 1, datetime('now','-17 days'), datetime('now','-15 days'), datetime('now','-19 days')),
  ('t-05-2c', 'ph-05-2', '2.3', 'Metric charts & sparklines', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-15 days'), datetime('now','-14 days'), datetime('now','-19 days')),
  ('t-05-3a', 'ph-05-3', '3.1', 'Slack alert integration', 'completed', 'comms', 'claude-sonnet-4-5-20250929', 0, datetime('now','-12 days'), datetime('now','-10 days'), datetime('now','-12 days')),
  ('t-05-3b', 'ph-05-3', '3.2', 'Custom alert thresholds', 'in_progress', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-9 days'), NULL, datetime('now','-12 days')),
  ('t-05-3c', 'ph-05-3', '3.3', 'PagerDuty incident bridge', 'pending', 'comms', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-12 days'));

-- proj-06 Social Analytics
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-06-1a', 'ph-06-1', '1.1', 'Twitter API v2 connector', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-45 days'), datetime('now','-43 days'), datetime('now','-45 days')),
  ('t-06-1b', 'ph-06-1', '1.2', 'Reddit & HN scrapers', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-43 days'), datetime('now','-41 days'), datetime('now','-45 days')),
  ('t-06-1c', 'ph-06-1', '1.3', 'Deduplication pipeline', 'completed', 'engineering', 'claude-opus-4-6', 2, datetime('now','-41 days'), datetime('now','-40 days'), datetime('now','-45 days')),
  ('t-06-2a', 'ph-06-2', '2.1', 'Transformer model fine-tuning', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-39 days'), datetime('now','-36 days'), datetime('now','-39 days')),
  ('t-06-2b', 'ph-06-2', '2.2', 'Streaming inference pipeline', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-36 days'), datetime('now','-34 days'), datetime('now','-39 days')),
  ('t-06-2c', 'ph-06-2', '2.3', 'Sentiment API endpoints', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-34 days'), datetime('now','-32 days'), datetime('now','-39 days')),
  ('t-06-3a', 'ph-06-3', '3.1', 'Time-series trend detector', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-31 days'), datetime('now','-28 days'), datetime('now','-31 days')),
  ('t-06-3b', 'ph-06-3', '3.2', 'Viral content scorer', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-28 days'), datetime('now','-26 days'), datetime('now','-31 days')),
  ('t-06-3c', 'ph-06-3', '3.3', 'Topic clustering engine', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-26 days'), datetime('now','-24 days'), datetime('now','-31 days')),
  ('t-06-4a', 'ph-06-4', '4.1', 'Interactive dashboard charts', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-23 days'), datetime('now','-20 days'), datetime('now','-23 days')),
  ('t-06-4b', 'ph-06-4', '4.2', 'Scheduled PDF report generator', 'completed', 'comms', 'claude-sonnet-4-5-20250929', 1, datetime('now','-20 days'), datetime('now','-18 days'), datetime('now','-23 days')),
  ('t-06-4c', 'ph-06-4', '4.3', 'Webhook & Slack notifications', 'completed', 'comms', 'claude-sonnet-4-5-20250929', 2, datetime('now','-18 days'), datetime('now','-16 days'), datetime('now','-23 days'));

-- proj-07 Real-time Chat
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-07-1a', 'ph-07-1', '1.1', 'Phoenix Channel handlers', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-18 days'), datetime('now','-16 days'), datetime('now','-18 days')),
  ('t-07-1b', 'ph-07-1', '1.2', 'Message persistence layer', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-16 days'), datetime('now','-14 days'), datetime('now','-18 days')),
  ('t-07-1c', 'ph-07-1', '1.3', 'Presence tracking system', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-14 days'), datetime('now','-13 days'), datetime('now','-18 days')),
  ('t-07-2a', 'ph-07-2', '2.1', 'Channel CRUD & permissions', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-12 days'), datetime('now','-10 days'), datetime('now','-12 days')),
  ('t-07-2b', 'ph-07-2', '2.2', 'Threaded reply support', 'in_progress', 'engineering', 'claude-opus-4-6', 1, datetime('now','-9 days'), NULL, datetime('now','-12 days')),
  ('t-07-2c', 'ph-07-2', '2.3', 'Full-text message search', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-12 days')),
  ('t-07-3a', 'ph-07-3', '3.1', 'File upload & preview', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 0, NULL, NULL, datetime('now','-12 days')),
  ('t-07-3b', 'ph-07-3', '3.2', 'Emoji reactions', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 1, NULL, NULL, datetime('now','-12 days')),
  ('t-07-3c', 'ph-07-3', '3.3', 'Read receipts', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-12 days'));

-- proj-08 CMS Platform
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-08-1a', 'ph-08-1', '1.1', 'Dynamic field type system', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-35 days'), datetime('now','-33 days'), datetime('now','-35 days')),
  ('t-08-1b', 'ph-08-1', '1.2', 'Content validation engine', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-33 days'), datetime('now','-31 days'), datetime('now','-35 days')),
  ('t-08-1c', 'ph-08-1', '1.3', 'Relationship & reference fields', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-31 days'), datetime('now','-30 days'), datetime('now','-35 days')),
  ('t-08-2a', 'ph-08-2', '2.1', 'Drag-and-drop component canvas', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-29 days'), datetime('now','-26 days'), datetime('now','-29 days')),
  ('t-08-2b', 'ph-08-2', '2.2', 'Component library (20+ blocks)', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-26 days'), datetime('now','-24 days'), datetime('now','-29 days')),
  ('t-08-2c', 'ph-08-2', '2.3', 'Responsive preview mode', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-24 days'), datetime('now','-22 days'), datetime('now','-29 days')),
  ('t-08-3a', 'ph-08-3', '3.1', 'Upload pipeline & CDN sync', 'completed', 'ground-crew', 'claude-sonnet-4-5-20250929', 0, datetime('now','-18 days'), datetime('now','-16 days'), datetime('now','-18 days')),
  ('t-08-3b', 'ph-08-3', '3.2', 'Image optimization service', 'in_progress', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-15 days'), NULL, datetime('now','-18 days')),
  ('t-08-3c', 'ph-08-3', '3.3', 'Media library browser', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-18 days')),
  ('t-08-4a', 'ph-08-4', '4.1', 'Tenant isolation middleware', 'pending', 'sentinel', 'claude-opus-4-6', 0, NULL, NULL, datetime('now','-18 days')),
  ('t-08-4b', 'ph-08-4', '4.2', 'Custom domain routing', 'pending', 'ground-crew', 'claude-sonnet-4-5-20250929', 1, NULL, NULL, datetime('now','-18 days')),
  ('t-08-4c', 'ph-08-4', '4.3', 'Per-tenant billing metering', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-18 days'));

-- proj-09 ML Pipeline
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-09-1a', 'ph-09-1', '1.1', 'Data validation framework', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-40 days'), datetime('now','-38 days'), datetime('now','-40 days')),
  ('t-09-1b', 'ph-09-1', '1.2', 'Feature engineering pipeline', 'completed', 'engineering', 'claude-opus-4-6', 1, datetime('now','-38 days'), datetime('now','-36 days'), datetime('now','-40 days')),
  ('t-09-1c', 'ph-09-1', '1.3', 'Dataset versioning with DVC', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-36 days'), datetime('now','-34 days'), datetime('now','-40 days')),
  ('t-09-2a', 'ph-09-2', '2.1', 'Distributed training orchestrator', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-33 days'), datetime('now','-30 days'), datetime('now','-33 days')),
  ('t-09-2b', 'ph-09-2', '2.2', 'Hyperparameter tuning (Optuna)', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-30 days'), datetime('now','-28 days'), datetime('now','-33 days')),
  ('t-09-2c', 'ph-09-2', '2.3', 'MLflow experiment tracking', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-28 days'), datetime('now','-26 days'), datetime('now','-33 days')),
  ('t-09-3a', 'ph-09-3', '3.1', 'FastAPI model server', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-25 days'), datetime('now','-22 days'), datetime('now','-25 days')),
  ('t-09-3b', 'ph-09-3', '3.2', 'Request batching & caching', 'completed', 'engineering', 'claude-opus-4-6', 1, datetime('now','-22 days'), datetime('now','-20 days'), datetime('now','-25 days')),
  ('t-09-3c', 'ph-09-3', '3.3', 'A/B testing framework', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-20 days'), datetime('now','-18 days'), datetime('now','-25 days')),
  ('t-09-4a', 'ph-09-4', '4.1', 'Data drift detection', 'in_progress', 'engineering', 'claude-opus-4-6', 0, datetime('now','-14 days'), NULL, datetime('now','-14 days')),
  ('t-09-4b', 'ph-09-4', '4.2', 'Performance metric tracking', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 1, NULL, NULL, datetime('now','-14 days')),
  ('t-09-4c', 'ph-09-4', '4.3', 'Auto-retraining trigger', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-14 days'));

-- proj-10 IoT Sensor Hub
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-10-1a', 'ph-10-1', '1.1', 'MQTT protocol handler', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-15 days'), datetime('now','-13 days'), datetime('now','-15 days')),
  ('t-10-1b', 'ph-10-1', '1.2', 'Device auth & ACL', 'completed', 'sentinel', 'claude-sonnet-4-5-20250929', 1, datetime('now','-13 days'), datetime('now','-11 days'), datetime('now','-15 days')),
  ('t-10-1c', 'ph-10-1', '1.3', 'Topic routing & QoS', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-11 days'), datetime('now','-10 days'), datetime('now','-15 days')),
  ('t-10-2a', 'ph-10-2', '2.1', 'TimescaleDB hypertable schema', 'in_progress', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-9 days'), NULL, datetime('now','-9 days')),
  ('t-10-2b', 'ph-10-2', '2.2', 'Continuous aggregates', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 1, NULL, NULL, datetime('now','-9 days')),
  ('t-10-2c', 'ph-10-2', '2.3', 'Data retention policies', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-9 days')),
  ('t-10-3a', 'ph-10-3', '3.1', 'Threshold alert engine', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 0, NULL, NULL, datetime('now','-9 days')),
  ('t-10-3b', 'ph-10-3', '3.2', 'Anomaly detection ML model', 'pending', 'engineering', 'claude-opus-4-6', 1, NULL, NULL, datetime('now','-9 days')),
  ('t-10-3c', 'ph-10-3', '3.3', 'Grafana dashboard templates', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-9 days'));

-- proj-11 HR Management (all completed)
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-11-1a', 'ph-11-1', '1.1', 'Employee CRUD & profiles', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-60 days'), datetime('now','-57 days'), datetime('now','-60 days')),
  ('t-11-1b', 'ph-11-1', '1.2', 'Org chart visualization', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-57 days'), datetime('now','-54 days'), datetime('now','-60 days')),
  ('t-11-1c', 'ph-11-1', '1.3', 'Department search & filters', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-54 days'), datetime('now','-52 days'), datetime('now','-60 days')),
  ('t-11-2a', 'ph-11-2', '2.1', 'Leave request workflow', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-51 days'), datetime('now','-48 days'), datetime('now','-51 days')),
  ('t-11-2b', 'ph-11-2', '2.2', 'Manager approval pipeline', 'completed', 'engineering', 'claude-opus-4-6', 1, datetime('now','-48 days'), datetime('now','-45 days'), datetime('now','-51 days')),
  ('t-11-2c', 'ph-11-2', '2.3', 'Attendance tracking & reports', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-45 days'), datetime('now','-42 days'), datetime('now','-51 days')),
  ('t-11-3a', 'ph-11-3', '3.1', 'Review cycle engine', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-41 days'), datetime('now','-38 days'), datetime('now','-41 days')),
  ('t-11-3b', 'ph-11-3', '3.2', '360 feedback forms', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-38 days'), datetime('now','-35 days'), datetime('now','-41 days')),
  ('t-11-3c', 'ph-11-3', '3.3', 'Goal tracking dashboard', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-35 days'), datetime('now','-32 days'), datetime('now','-41 days'));

-- proj-12 Video Streaming
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-12-1a', 'ph-12-1', '1.1', 'FFmpeg transcoding worker', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-22 days'), datetime('now','-20 days'), datetime('now','-22 days')),
  ('t-12-1b', 'ph-12-1', '1.2', 'HLS manifest generator', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-20 days'), datetime('now','-18 days'), datetime('now','-22 days')),
  ('t-12-1c', 'ph-12-1', '1.3', 'Thumbnail extraction pipeline', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-18 days'), datetime('now','-16 days'), datetime('now','-22 days')),
  ('t-12-2a', 'ph-12-2', '2.1', 'HLS.js adaptive player', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-15 days'), datetime('now','-13 days'), datetime('now','-15 days')),
  ('t-12-2b', 'ph-12-2', '2.2', 'CloudFront CDN integration', 'in_progress', 'ground-crew', 'claude-sonnet-4-5-20250929', 1, datetime('now','-12 days'), NULL, datetime('now','-15 days')),
  ('t-12-2c', 'ph-12-2', '2.3', 'DRM encryption (Widevine/FairPlay)', 'pending', 'sentinel', 'claude-opus-4-6', 2, NULL, NULL, datetime('now','-15 days')),
  ('t-12-3a', 'ph-12-3', '3.1', 'Upload & progress tracking', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 0, NULL, NULL, datetime('now','-15 days')),
  ('t-12-3b', 'ph-12-3', '3.2', 'Video analytics dashboard', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 1, NULL, NULL, datetime('now','-15 days')),
  ('t-12-3c', 'ph-12-3', '3.3', 'Channel management UI', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-15 days'));

-- proj-13 Crypto Trading Bot
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-13-1a', 'ph-13-1', '1.1', 'Binance REST & WS connector', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-28 days'), datetime('now','-26 days'), datetime('now','-28 days')),
  ('t-13-1b', 'ph-13-1', '1.2', 'Coinbase Pro connector', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-26 days'), datetime('now','-24 days'), datetime('now','-28 days')),
  ('t-13-1c', 'ph-13-1', '1.3', 'Unified order book model', 'completed', 'engineering', 'claude-opus-4-6', 2, datetime('now','-24 days'), datetime('now','-22 days'), datetime('now','-28 days')),
  ('t-13-2a', 'ph-13-2', '2.1', 'Backtesting engine core', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-21 days'), datetime('now','-18 days'), datetime('now','-21 days')),
  ('t-13-2b', 'ph-13-2', '2.2', 'Strategy DSL & parser', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-18 days'), datetime('now','-16 days'), datetime('now','-21 days')),
  ('t-13-2c', 'ph-13-2', '2.3', 'Performance analytics (Sharpe, drawdown)', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-16 days'), datetime('now','-14 days'), datetime('now','-21 days')),
  ('t-13-3a', 'ph-13-3', '3.1', 'Paper trading execution', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-13 days'), datetime('now','-11 days'), datetime('now','-13 days')),
  ('t-13-3b', 'ph-13-3', '3.2', 'Risk management engine', 'in_progress', 'sentinel', 'claude-opus-4-6', 1, datetime('now','-10 days'), NULL, datetime('now','-13 days')),
  ('t-13-3c', 'ph-13-3', '3.3', 'Position sizing calculator', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-13 days')),
  ('t-13-4a', 'ph-13-4', '4.1', 'P&L tracking & charts', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 0, NULL, NULL, datetime('now','-13 days')),
  ('t-13-4b', 'ph-13-4', '4.2', 'Trade journal system', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 1, NULL, NULL, datetime('now','-13 days')),
  ('t-13-4c', 'ph-13-4', '4.3', 'Tax report generator', 'pending', 'comms', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-13 days'));

-- proj-14 Fitness Tracker
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-14-1a', 'ph-14-1', '1.1', 'Exercise library & search', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-20 days'), datetime('now','-18 days'), datetime('now','-20 days')),
  ('t-14-1b', 'ph-14-1', '1.2', 'Workout builder & templates', 'completed', 'engineering', 'claude-opus-4-6', 1, datetime('now','-18 days'), datetime('now','-16 days'), datetime('now','-20 days')),
  ('t-14-1c', 'ph-14-1', '1.3', 'Timer, rep & set tracking', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-16 days'), datetime('now','-14 days'), datetime('now','-20 days')),
  ('t-14-2a', 'ph-14-2', '2.1', 'Body metrics logging', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-13 days'), datetime('now','-11 days'), datetime('now','-13 days')),
  ('t-14-2b', 'ph-14-2', '2.2', 'Strength progression charts', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-11 days'), datetime('now','-9 days'), datetime('now','-13 days')),
  ('t-14-2c', 'ph-14-2', '2.3', 'Personal records & milestones', 'completed', 'engineering', 'claude-opus-4-6', 2, datetime('now','-9 days'), datetime('now','-7 days'), datetime('now','-13 days')),
  ('t-14-3a', 'ph-14-3', '3.1', 'Activity feed & social graph', 'in_progress', 'engineering', 'claude-sonnet-4-5-20250929', 0, datetime('now','-6 days'), NULL, datetime('now','-6 days')),
  ('t-14-3b', 'ph-14-3', '3.2', 'Challenge system', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 1, NULL, NULL, datetime('now','-6 days')),
  ('t-14-3c', 'ph-14-3', '3.3', 'Achievement badges & leaderboards', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-6 days'));

-- proj-15 Doc Collaboration
INSERT OR IGNORE INTO tasks (id, phase_id, task_number, name, status, agent, model, order_index, started_at, completed_at, created_at) VALUES
  ('t-15-1a', 'ph-15-1', '1.1', 'Y.js document schema', 'completed', 'engineering', 'claude-opus-4-6', 0, datetime('now','-12 days'), datetime('now','-10 days'), datetime('now','-12 days')),
  ('t-15-1b', 'ph-15-1', '1.2', 'Rich text editor (Tiptap)', 'completed', 'engineering', 'claude-sonnet-4-5-20250929', 1, datetime('now','-10 days'), datetime('now','-8 days'), datetime('now','-12 days')),
  ('t-15-1c', 'ph-15-1', '1.3', 'Table & embed block types', 'in_progress', 'engineering', 'claude-sonnet-4-5-20250929', 2, datetime('now','-7 days'), NULL, datetime('now','-12 days')),
  ('t-15-2a', 'ph-15-2', '2.1', 'WebRTC signaling server', 'pending', 'engineering', 'claude-opus-4-6', 0, NULL, NULL, datetime('now','-12 days')),
  ('t-15-2b', 'ph-15-2', '2.2', 'Peer connection manager', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 1, NULL, NULL, datetime('now','-12 days')),
  ('t-15-2c', 'ph-15-2', '2.3', 'Awareness protocol (cursors)', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-12 days')),
  ('t-15-3a', 'ph-15-3', '3.1', 'Inline comments system', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 0, NULL, NULL, datetime('now','-12 days')),
  ('t-15-3b', 'ph-15-3', '3.2', 'Version history & diffing', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 1, NULL, NULL, datetime('now','-12 days')),
  ('t-15-3c', 'ph-15-3', '3.3', 'Document snapshots & export', 'pending', 'engineering', 'claude-sonnet-4-5-20250929', 2, NULL, NULL, datetime('now','-12 days'));

-- ============================================================================
-- EXECUTIONS (2 per project = 24 new)
-- ============================================================================

INSERT OR IGNORE INTO executions (id, project_id, session_number, phase_current, phase_total, task_current, task_total, status, cost_total, started_at, completed_at, created_at) VALUES
  ('exec-04-1', 'proj-04', 1, '3', 4, '10', 12, 'completed', 35.50, datetime('now','-30 days'), datetime('now','-14 days'), datetime('now','-30 days')),
  ('exec-04-2', 'proj-04', 2, '4', 4, '11', 12, 'running', 6.80, datetime('now','-10 days'), NULL, datetime('now','-10 days')),
  ('exec-05-1', 'proj-05', 1, '2', 3, '7', 9, 'completed', 17.60, datetime('now','-25 days'), datetime('now','-14 days'), datetime('now','-25 days')),
  ('exec-05-2', 'proj-05', 2, '3', 3, '8', 9, 'running', 4.50, datetime('now','-12 days'), NULL, datetime('now','-12 days')),
  ('exec-06-1', 'proj-06', 1, '4', 4, '12', 12, 'completed', 42.80, datetime('now','-45 days'), datetime('now','-24 days'), datetime('now','-45 days')),
  ('exec-06-2', 'proj-06', 2, '4', 4, '12', 12, 'completed', 10.00, datetime('now','-23 days'), datetime('now','-16 days'), datetime('now','-23 days')),
  ('exec-07-1', 'proj-07', 1, '1', 3, '4', 9, 'completed', 8.50, datetime('now','-18 days'), datetime('now','-13 days'), datetime('now','-18 days')),
  ('exec-07-2', 'proj-07', 2, '2', 3, '5', 9, 'running', 4.00, datetime('now','-12 days'), NULL, datetime('now','-12 days')),
  ('exec-08-1', 'proj-08', 1, '2', 4, '7', 12, 'completed', 22.60, datetime('now','-35 days'), datetime('now','-22 days'), datetime('now','-35 days')),
  ('exec-08-2', 'proj-08', 2, '3', 4, '8', 12, 'running', 6.00, datetime('now','-18 days'), NULL, datetime('now','-18 days')),
  ('exec-09-1', 'proj-09', 1, '3', 4, '9', 12, 'completed', 43.90, datetime('now','-40 days'), datetime('now','-18 days'), datetime('now','-40 days')),
  ('exec-09-2', 'proj-09', 2, '4', 4, '10', 12, 'running', 5.00, datetime('now','-14 days'), NULL, datetime('now','-14 days')),
  ('exec-10-1', 'proj-10', 1, '1', 3, '3', 9, 'completed', 8.40, datetime('now','-15 days'), datetime('now','-10 days'), datetime('now','-15 days')),
  ('exec-10-2', 'proj-10', 2, '2', 3, '4', 9, 'running', 0.00, datetime('now','-9 days'), NULL, datetime('now','-9 days')),
  ('exec-11-1', 'proj-11', 1, '3', 3, '9', 9, 'completed', 28.50, datetime('now','-60 days'), datetime('now','-42 days'), datetime('now','-60 days')),
  ('exec-11-2', 'proj-11', 2, '3', 3, '9', 9, 'completed', 10.00, datetime('now','-41 days'), datetime('now','-32 days'), datetime('now','-41 days')),
  ('exec-12-1', 'proj-12', 1, '1', 3, '4', 9, 'completed', 12.80, datetime('now','-22 days'), datetime('now','-16 days'), datetime('now','-22 days')),
  ('exec-12-2', 'proj-12', 2, '2', 3, '5', 9, 'running', 3.00, datetime('now','-15 days'), NULL, datetime('now','-15 days')),
  ('exec-13-1', 'proj-13', 1, '2', 4, '7', 12, 'completed', 22.40, datetime('now','-28 days'), datetime('now','-14 days'), datetime('now','-28 days')),
  ('exec-13-2', 'proj-13', 2, '3', 4, '8', 12, 'running', 6.00, datetime('now','-13 days'), NULL, datetime('now','-13 days')),
  ('exec-14-1', 'proj-14', 1, '2', 3, '6', 9, 'completed', 21.60, datetime('now','-20 days'), datetime('now','-7 days'), datetime('now','-20 days')),
  ('exec-14-2', 'proj-14', 2, '3', 3, '7', 9, 'running', 3.00, datetime('now','-6 days'), NULL, datetime('now','-6 days')),
  ('exec-15-1', 'proj-15', 1, '1', 3, '3', 9, 'running', 8.20, datetime('now','-12 days'), NULL, datetime('now','-12 days')),
  ('exec-15-2', 'proj-15', 2, '1', 3, '1', 9, 'paused', 2.00, datetime('now','-5 days'), NULL, datetime('now','-5 days'));

-- ============================================================================
-- COSTS (5-6 per project = ~65 new)
-- ============================================================================

INSERT OR IGNORE INTO costs (id, project_id, execution_id, phase, task, agent, model, input_tokens, output_tokens, total_cost, created_at) VALUES
  ('cost-04-01', 'proj-04', 'exec-04-1', 'Product Catalog', 'Product schema & CRUD API', 'engineering', 'claude-sonnet-4-5-20250929', 42000, 14000, 3.50, datetime('now','-30 days')),
  ('cost-04-02', 'proj-04', 'exec-04-1', 'Product Catalog', 'Category tree & faceted search', 'engineering', 'claude-sonnet-4-5-20250929', 38000, 12000, 3.50, datetime('now','-28 days')),
  ('cost-04-03', 'proj-04', 'exec-04-1', 'Cart & Checkout', 'Stripe checkout integration', 'sentinel', 'claude-opus-4-6', 65000, 22000, 5.80, datetime('now','-23 days')),
  ('cost-04-04', 'proj-04', 'exec-04-1', 'Order Management', 'Admin order dashboard', 'engineering', 'claude-opus-4-6', 58000, 20000, 4.20, datetime('now','-15 days')),
  ('cost-04-05', 'proj-04', 'exec-04-2', 'Reviews & Recommendations', 'Collaborative filtering engine', 'engineering', 'claude-opus-4-6', 70000, 24000, 6.80, datetime('now','-7 days')),
  ('cost-05-01', 'proj-05', 'exec-05-1', 'Data Collection', 'Prometheus metrics scraper', 'engineering', 'claude-sonnet-4-5-20250929', 35000, 10000, 2.80, datetime('now','-25 days')),
  ('cost-05-02', 'proj-05', 'exec-05-1', 'Dashboard UI', 'Deploy history timeline', 'engineering', 'claude-opus-4-6', 55000, 18000, 4.20, datetime('now','-17 days')),
  ('cost-05-03', 'proj-05', 'exec-05-1', 'Dashboard UI', 'Metric charts & sparklines', 'engineering', 'claude-sonnet-4-5-20250929', 30000, 9000, 2.40, datetime('now','-15 days')),
  ('cost-05-04', 'proj-05', 'exec-05-2', 'Alerting & Integrations', 'Slack alert integration', 'comms', 'claude-sonnet-4-5-20250929', 28000, 8000, 2.20, datetime('now','-10 days')),
  ('cost-05-05', 'proj-05', 'exec-05-2', 'Alerting & Integrations', 'Custom alert thresholds', 'engineering', 'claude-sonnet-4-5-20250929', 32000, 10000, 2.30, datetime('now','-9 days')),
  ('cost-06-01', 'proj-06', 'exec-06-1', 'Data Ingestion', 'Twitter API v2 connector', 'engineering', 'claude-sonnet-4-5-20250929', 40000, 13000, 3.20, datetime('now','-45 days')),
  ('cost-06-02', 'proj-06', 'exec-06-1', 'Sentiment Analysis', 'Transformer model fine-tuning', 'engineering', 'claude-opus-4-6', 85000, 30000, 8.50, datetime('now','-39 days')),
  ('cost-06-03', 'proj-06', 'exec-06-1', 'Trend Detection', 'Time-series trend detector', 'engineering', 'claude-opus-4-6', 72000, 25000, 7.00, datetime('now','-31 days')),
  ('cost-06-04', 'proj-06', 'exec-06-1', 'Trend Detection', 'Topic clustering engine', 'engineering', 'claude-sonnet-4-5-20250929', 45000, 15000, 3.60, datetime('now','-26 days')),
  ('cost-06-05', 'proj-06', 'exec-06-2', 'Dashboard & Reports', 'Interactive dashboard charts', 'engineering', 'claude-sonnet-4-5-20250929', 38000, 12000, 3.00, datetime('now','-20 days')),
  ('cost-07-01', 'proj-07', 'exec-07-1', 'Core Messaging', 'Phoenix Channel handlers', 'engineering', 'claude-opus-4-6', 52000, 18000, 4.20, datetime('now','-18 days')),
  ('cost-07-02', 'proj-07', 'exec-07-1', 'Core Messaging', 'Presence tracking system', 'engineering', 'claude-sonnet-4-5-20250929', 28000, 9000, 2.30, datetime('now','-13 days')),
  ('cost-07-03', 'proj-07', 'exec-07-2', 'Channels & Threads', 'Threaded reply support', 'engineering', 'claude-opus-4-6', 60000, 20000, 4.00, datetime('now','-9 days')),
  ('cost-08-01', 'proj-08', 'exec-08-1', 'Content Models', 'Dynamic field type system', 'engineering', 'claude-opus-4-6', 62000, 21000, 5.10, datetime('now','-35 days')),
  ('cost-08-02', 'proj-08', 'exec-08-1', 'Page Builder', 'Drag-and-drop component canvas', 'engineering', 'claude-opus-4-6', 75000, 26000, 6.50, datetime('now','-29 days')),
  ('cost-08-03', 'proj-08', 'exec-08-1', 'Page Builder', 'Component library (20+ blocks)', 'engineering', 'claude-sonnet-4-5-20250929', 48000, 16000, 3.80, datetime('now','-26 days')),
  ('cost-08-04', 'proj-08', 'exec-08-2', 'Asset Management', 'Upload pipeline & CDN sync', 'ground-crew', 'claude-sonnet-4-5-20250929', 32000, 10000, 2.50, datetime('now','-16 days')),
  ('cost-08-05', 'proj-08', 'exec-08-2', 'Asset Management', 'Image optimization service', 'engineering', 'claude-sonnet-4-5-20250929', 35000, 11000, 3.50, datetime('now','-15 days')),
  ('cost-09-01', 'proj-09', 'exec-09-1', 'Data Processing', 'Feature engineering pipeline', 'engineering', 'claude-opus-4-6', 78000, 28000, 7.20, datetime('now','-38 days')),
  ('cost-09-02', 'proj-09', 'exec-09-1', 'Model Training', 'Distributed training orchestrator', 'engineering', 'claude-opus-4-6', 92000, 32000, 9.50, datetime('now','-33 days')),
  ('cost-09-03', 'proj-09', 'exec-09-1', 'Model Training', 'Hyperparameter tuning (Optuna)', 'engineering', 'claude-sonnet-4-5-20250929', 55000, 18000, 4.40, datetime('now','-30 days')),
  ('cost-09-04', 'proj-09', 'exec-09-1', 'Model Serving', 'Request batching & caching', 'engineering', 'claude-opus-4-6', 68000, 23000, 5.80, datetime('now','-22 days')),
  ('cost-09-05', 'proj-09', 'exec-09-2', 'Monitoring & Drift', 'Data drift detection', 'engineering', 'claude-opus-4-6', 72000, 25000, 5.00, datetime('now','-14 days')),
  ('cost-10-01', 'proj-10', 'exec-10-1', 'MQTT Broker', 'MQTT protocol handler', 'engineering', 'claude-opus-4-6', 55000, 19000, 4.20, datetime('now','-15 days')),
  ('cost-10-02', 'proj-10', 'exec-10-1', 'MQTT Broker', 'Device auth & ACL', 'sentinel', 'claude-sonnet-4-5-20250929', 32000, 10000, 2.20, datetime('now','-13 days')),
  ('cost-10-03', 'proj-10', 'exec-10-1', 'MQTT Broker', 'Topic routing & QoS', 'engineering', 'claude-sonnet-4-5-20250929', 28000, 9000, 2.00, datetime('now','-11 days')),
  ('cost-11-01', 'proj-11', 'exec-11-1', 'Employee Directory', 'Employee CRUD & profiles', 'engineering', 'claude-sonnet-4-5-20250929', 38000, 12000, 3.00, datetime('now','-60 days')),
  ('cost-11-02', 'proj-11', 'exec-11-1', 'Leave & Attendance', 'Manager approval pipeline', 'engineering', 'claude-opus-4-6', 62000, 21000, 5.50, datetime('now','-48 days')),
  ('cost-11-03', 'proj-11', 'exec-11-1', 'Performance Reviews', 'Review cycle engine', 'engineering', 'claude-opus-4-6', 70000, 24000, 6.80, datetime('now','-41 days')),
  ('cost-11-04', 'proj-11', 'exec-11-2', 'Performance Reviews', '360 feedback forms', 'engineering', 'claude-sonnet-4-5-20250929', 42000, 14000, 3.20, datetime('now','-38 days')),
  ('cost-12-01', 'proj-12', 'exec-12-1', 'Transcoding Pipeline', 'FFmpeg transcoding worker', 'engineering', 'claude-opus-4-6', 68000, 23000, 5.80, datetime('now','-22 days')),
  ('cost-12-02', 'proj-12', 'exec-12-1', 'Transcoding Pipeline', 'HLS manifest generator', 'engineering', 'claude-sonnet-4-5-20250929', 35000, 11000, 3.50, datetime('now','-20 days')),
  ('cost-12-03', 'proj-12', 'exec-12-1', 'Transcoding Pipeline', 'Thumbnail extraction pipeline', 'engineering', 'claude-sonnet-4-5-20250929', 30000, 10000, 3.50, datetime('now','-18 days')),
  ('cost-12-04', 'proj-12', 'exec-12-2', 'Playback & CDN', 'HLS.js adaptive player', 'engineering', 'claude-sonnet-4-5-20250929', 38000, 12000, 3.00, datetime('now','-13 days')),
  ('cost-13-01', 'proj-13', 'exec-13-1', 'Exchange Connectors', 'Unified order book model', 'engineering', 'claude-opus-4-6', 65000, 22000, 5.40, datetime('now','-24 days')),
  ('cost-13-02', 'proj-13', 'exec-13-1', 'Strategy Framework', 'Backtesting engine core', 'engineering', 'claude-opus-4-6', 82000, 28000, 7.00, datetime('now','-21 days')),
  ('cost-13-03', 'proj-13', 'exec-13-1', 'Strategy Framework', 'Strategy DSL & parser', 'engineering', 'claude-sonnet-4-5-20250929', 45000, 15000, 4.00, datetime('now','-18 days')),
  ('cost-13-04', 'proj-13', 'exec-13-2', 'Live Trading', 'Paper trading execution', 'engineering', 'claude-sonnet-4-5-20250929', 38000, 12000, 2.00, datetime('now','-11 days')),
  ('cost-13-05', 'proj-13', 'exec-13-2', 'Live Trading', 'Risk management engine', 'sentinel', 'claude-opus-4-6', 58000, 20000, 4.00, datetime('now','-10 days')),
  ('cost-14-01', 'proj-14', 'exec-14-1', 'Workout Engine', 'Workout builder & templates', 'engineering', 'claude-opus-4-6', 55000, 19000, 5.20, datetime('now','-18 days')),
  ('cost-14-02', 'proj-14', 'exec-14-1', 'Progress & Analytics', 'Strength progression charts', 'engineering', 'claude-sonnet-4-5-20250929', 40000, 13000, 3.20, datetime('now','-11 days')),
  ('cost-14-03', 'proj-14', 'exec-14-1', 'Progress & Analytics', 'Personal records & milestones', 'engineering', 'claude-opus-4-6', 52000, 18000, 4.20, datetime('now','-9 days')),
  ('cost-14-04', 'proj-14', 'exec-14-2', 'Social & Gamification', 'Activity feed & social graph', 'engineering', 'claude-sonnet-4-5-20250929', 35000, 11000, 3.00, datetime('now','-6 days')),
  ('cost-15-01', 'proj-15', 'exec-15-1', 'CRDT Document Model', 'Y.js document schema', 'engineering', 'claude-opus-4-6', 72000, 25000, 4.50, datetime('now','-12 days')),
  ('cost-15-02', 'proj-15', 'exec-15-1', 'CRDT Document Model', 'Rich text editor (Tiptap)', 'engineering', 'claude-sonnet-4-5-20250929', 45000, 15000, 3.70, datetime('now','-10 days'));

-- ============================================================================
-- ACTIVITY LOG (8 per project = ~96 new)
-- ============================================================================

INSERT OR IGNORE INTO activity_log (id, project_id, execution_id, event_type, message, created_at) VALUES
  ('act-04-01', 'proj-04', 'exec-04-1', 'execution_started', 'Execution #1 started — v1.0 Storefront Launch', datetime('now','-30 days')),
  ('act-04-02', 'proj-04', 'exec-04-1', 'phase_completed', 'Phase 1: Product Catalog completed — $10.50', datetime('now','-26 days')),
  ('act-04-03', 'proj-04', 'exec-04-1', 'phase_completed', 'Phase 2: Cart & Checkout completed — $13.20', datetime('now','-20 days')),
  ('act-04-04', 'proj-04', 'exec-04-1', 'task_completed', 'Completed: Admin order dashboard (engineering)', datetime('now','-14 days')),
  ('act-04-05', 'proj-04', 'exec-04-1', 'phase_completed', 'Phase 3: Order Management completed — $11.80', datetime('now','-14 days')),
  ('act-04-06', 'proj-04', 'exec-04-1', 'execution_completed', 'Execution #1 completed — $35.50 total', datetime('now','-14 days')),
  ('act-04-07', 'proj-04', 'exec-04-2', 'execution_started', 'Execution #2 started — Reviews & Recommendations', datetime('now','-10 days')),
  ('act-04-08', 'proj-04', 'exec-04-2', 'task_completed', 'Completed: Review & rating system (engineering)', datetime('now','-8 days')),
  ('act-05-01', 'proj-05', 'exec-05-1', 'execution_started', 'Execution #1 started — Internal Beta', datetime('now','-25 days')),
  ('act-05-02', 'proj-05', 'exec-05-1', 'phase_completed', 'Phase 1: Data Collection completed — $8.20', datetime('now','-20 days')),
  ('act-05-03', 'proj-05', 'exec-05-1', 'phase_completed', 'Phase 2: Dashboard UI completed — $9.40', datetime('now','-14 days')),
  ('act-05-04', 'proj-05', 'exec-05-1', 'execution_completed', 'Execution #1 completed — $17.60', datetime('now','-14 days')),
  ('act-05-05', 'proj-05', 'exec-05-2', 'execution_started', 'Execution #2 started — Alerting phase', datetime('now','-12 days')),
  ('act-05-06', 'proj-05', 'exec-05-2', 'task_completed', 'Completed: Slack alert integration (comms)', datetime('now','-10 days')),
  ('act-05-07', 'proj-05', 'exec-05-2', 'decision_made', 'Chose PagerDuty over Opsgenie for incident management', datetime('now','-9 days')),
  ('act-05-08', 'proj-05', 'exec-05-2', 'task_started', 'Started: Custom alert thresholds (engineering)', datetime('now','-9 days')),
  ('act-06-01', 'proj-06', 'exec-06-1', 'execution_started', 'Execution #1 started — v2.0 Analytics Overhaul', datetime('now','-45 days')),
  ('act-06-02', 'proj-06', 'exec-06-1', 'phase_completed', 'Phase 1: Data Ingestion completed — $12.50', datetime('now','-40 days')),
  ('act-06-03', 'proj-06', 'exec-06-1', 'decision_made', 'Fine-tuned DistilBERT over full BERT for 3x inference speed', datetime('now','-38 days')),
  ('act-06-04', 'proj-06', 'exec-06-1', 'phase_completed', 'Phase 2: Sentiment Analysis completed — $16.30', datetime('now','-32 days')),
  ('act-06-05', 'proj-06', 'exec-06-1', 'phase_completed', 'Phase 3: Trend Detection completed — $13.00', datetime('now','-24 days')),
  ('act-06-06', 'proj-06', 'exec-06-1', 'execution_completed', 'Execution #1 completed — $42.80 total', datetime('now','-24 days')),
  ('act-06-07', 'proj-06', 'exec-06-2', 'execution_started', 'Execution #2 started — Dashboard & Reports', datetime('now','-23 days')),
  ('act-06-08', 'proj-06', 'exec-06-2', 'execution_completed', 'Execution #2 completed — all phases done!', datetime('now','-16 days')),
  ('act-07-01', 'proj-07', 'exec-07-1', 'execution_started', 'Execution #1 started — MVP Release', datetime('now','-18 days')),
  ('act-07-02', 'proj-07', 'exec-07-1', 'phase_completed', 'Phase 1: Core Messaging completed — $8.50', datetime('now','-13 days')),
  ('act-07-03', 'proj-07', 'exec-07-2', 'execution_started', 'Execution #2 started — Channels & Threads', datetime('now','-12 days')),
  ('act-07-04', 'proj-07', 'exec-07-2', 'task_completed', 'Completed: Channel CRUD & permissions', datetime('now','-10 days')),
  ('act-07-05', 'proj-07', 'exec-07-2', 'task_started', 'Started: Threaded reply support (engineering)', datetime('now','-9 days')),
  ('act-08-01', 'proj-08', 'exec-08-1', 'execution_started', 'Execution #1 started — v3.0 Page Builder', datetime('now','-35 days')),
  ('act-08-02', 'proj-08', 'exec-08-1', 'phase_completed', 'Phase 1: Content Models completed — $10.20', datetime('now','-30 days')),
  ('act-08-03', 'proj-08', 'exec-08-1', 'decision_made', 'Chose Inertia.js over API-based SPA for simpler data flow', datetime('now','-29 days')),
  ('act-08-04', 'proj-08', 'exec-08-1', 'phase_completed', 'Phase 2: Page Builder completed — $12.40', datetime('now','-22 days')),
  ('act-08-05', 'proj-08', 'exec-08-2', 'execution_started', 'Execution #2 started — Asset Management', datetime('now','-18 days')),
  ('act-08-06', 'proj-08', 'exec-08-2', 'task_completed', 'Completed: Upload pipeline & CDN sync', datetime('now','-16 days')),
  ('act-09-01', 'proj-09', 'exec-09-1', 'execution_started', 'Execution #1 started — Training Pipeline v1', datetime('now','-40 days')),
  ('act-09-02', 'proj-09', 'exec-09-1', 'phase_completed', 'Phase 1: Data Processing completed — $14.20', datetime('now','-34 days')),
  ('act-09-03', 'proj-09', 'exec-09-1', 'phase_completed', 'Phase 2: Model Training completed — $17.50', datetime('now','-26 days')),
  ('act-09-04', 'proj-09', 'exec-09-1', 'decision_made', 'Selected MLflow over W&B for self-hosted experiment tracking', datetime('now','-28 days')),
  ('act-09-05', 'proj-09', 'exec-09-1', 'phase_completed', 'Phase 3: Model Serving completed — $12.20', datetime('now','-18 days')),
  ('act-09-06', 'proj-09', 'exec-09-1', 'execution_completed', 'Execution #1 completed — $43.90 total', datetime('now','-18 days')),
  ('act-09-07', 'proj-09', 'exec-09-2', 'execution_started', 'Execution #2 started — Monitoring & Drift', datetime('now','-14 days')),
  ('act-09-08', 'proj-09', 'exec-09-2', 'task_started', 'Started: Data drift detection (engineering)', datetime('now','-14 days')),
  ('act-10-01', 'proj-10', 'exec-10-1', 'execution_started', 'Execution #1 started — Sensor Platform MVP', datetime('now','-15 days')),
  ('act-10-02', 'proj-10', 'exec-10-1', 'phase_completed', 'Phase 1: MQTT Broker completed — $8.40', datetime('now','-10 days')),
  ('act-10-03', 'proj-10', 'exec-10-1', 'execution_completed', 'Execution #1 completed — $8.40', datetime('now','-10 days')),
  ('act-10-04', 'proj-10', 'exec-10-2', 'execution_started', 'Execution #2 started — Time-Series Storage', datetime('now','-9 days')),
  ('act-10-05', 'proj-10', 'exec-10-2', 'task_started', 'Started: TimescaleDB hypertable schema', datetime('now','-9 days')),
  ('act-11-01', 'proj-11', 'exec-11-1', 'execution_started', 'Execution #1 started — v2.0 Complete', datetime('now','-60 days')),
  ('act-11-02', 'proj-11', 'exec-11-1', 'phase_completed', 'Phase 1: Employee Directory completed — $11.50', datetime('now','-52 days')),
  ('act-11-03', 'proj-11', 'exec-11-1', 'phase_completed', 'Phase 2: Leave & Attendance completed — $13.80', datetime('now','-42 days')),
  ('act-11-04', 'proj-11', 'exec-11-1', 'execution_completed', 'Execution #1 completed — $28.50', datetime('now','-42 days')),
  ('act-11-05', 'proj-11', 'exec-11-2', 'execution_started', 'Execution #2 started — Performance Reviews', datetime('now','-41 days')),
  ('act-11-06', 'proj-11', 'exec-11-2', 'execution_completed', 'Execution #2 completed — project archived', datetime('now','-32 days')),
  ('act-12-01', 'proj-12', 'exec-12-1', 'execution_started', 'Execution #1 started — Streaming MVP', datetime('now','-22 days')),
  ('act-12-02', 'proj-12', 'exec-12-1', 'decision_made', 'Chose HLS over DASH for broader iOS compatibility', datetime('now','-20 days')),
  ('act-12-03', 'proj-12', 'exec-12-1', 'phase_completed', 'Phase 1: Transcoding Pipeline completed — $12.80', datetime('now','-16 days')),
  ('act-12-04', 'proj-12', 'exec-12-2', 'execution_started', 'Execution #2 started — Playback & CDN', datetime('now','-15 days')),
  ('act-12-05', 'proj-12', 'exec-12-2', 'task_started', 'Started: CloudFront CDN integration (ground-crew)', datetime('now','-12 days')),
  ('act-13-01', 'proj-13', 'exec-13-1', 'execution_started', 'Execution #1 started — Trading Engine v1', datetime('now','-28 days')),
  ('act-13-02', 'proj-13', 'exec-13-1', 'phase_completed', 'Phase 1: Exchange Connectors completed — $10.40', datetime('now','-22 days')),
  ('act-13-03', 'proj-13', 'exec-13-1', 'phase_completed', 'Phase 2: Strategy Framework completed — $12.00', datetime('now','-14 days')),
  ('act-13-04', 'proj-13', 'exec-13-1', 'execution_completed', 'Execution #1 completed — $22.40', datetime('now','-14 days')),
  ('act-13-05', 'proj-13', 'exec-13-2', 'execution_started', 'Execution #2 started — Live Trading', datetime('now','-13 days')),
  ('act-13-06', 'proj-13', 'exec-13-2', 'decision_made', 'Paper trading mode mandatory for first 7 days before live', datetime('now','-11 days')),
  ('act-13-07', 'proj-13', 'exec-13-2', 'task_started', 'Started: Risk management engine (sentinel)', datetime('now','-10 days')),
  ('act-14-01', 'proj-14', 'exec-14-1', 'execution_started', 'Execution #1 started — v1.0 App Launch', datetime('now','-20 days')),
  ('act-14-02', 'proj-14', 'exec-14-1', 'phase_completed', 'Phase 1: Workout Engine completed — $10.20', datetime('now','-14 days')),
  ('act-14-03', 'proj-14', 'exec-14-1', 'phase_completed', 'Phase 2: Progress & Analytics completed — $11.40', datetime('now','-7 days')),
  ('act-14-04', 'proj-14', 'exec-14-1', 'execution_completed', 'Execution #1 completed — $21.60', datetime('now','-7 days')),
  ('act-14-05', 'proj-14', 'exec-14-2', 'execution_started', 'Execution #2 started — Social & Gamification', datetime('now','-6 days')),
  ('act-14-06', 'proj-14', 'exec-14-2', 'task_started', 'Started: Activity feed & social graph', datetime('now','-6 days')),
  ('act-15-01', 'proj-15', 'exec-15-1', 'execution_started', 'Execution #1 started — Editor Core', datetime('now','-12 days')),
  ('act-15-02', 'proj-15', 'exec-15-1', 'task_completed', 'Completed: Y.js document schema (engineering)', datetime('now','-10 days')),
  ('act-15-03', 'proj-15', 'exec-15-1', 'task_completed', 'Completed: Rich text editor Tiptap (engineering)', datetime('now','-8 days')),
  ('act-15-04', 'proj-15', 'exec-15-1', 'task_started', 'Started: Table & embed block types', datetime('now','-7 days')),
  ('act-15-05', 'proj-15', 'exec-15-2', 'execution_paused', 'Execution #2 paused — waiting for WebRTC architecture review', datetime('now','-5 days'));

-- ============================================================================
-- DECISIONS (3 per project = 36 new)
-- ============================================================================

INSERT OR IGNORE INTO decisions (id, project_id, execution_id, phase, category, question, answer, reasoning, tags, impact_status, created_at) VALUES
  ('dec-04-1', 'proj-04', 'exec-04-1', 'Product Catalog', 'architecture', 'Search engine for products?', 'Meilisearch', 'Typo-tolerant, fast indexing, simpler than Elasticsearch for our scale.', '["search","performance"]', 'active', datetime('now','-28 days')),
  ('dec-04-2', 'proj-04', 'exec-04-1', 'Cart & Checkout', 'technology', 'Cart state persistence?', 'Server-side with Redis', 'Survives browser close, enables cross-device cart. Redis TTL for auto-expiry.', '["state","redis","cart"]', 'active', datetime('now','-24 days')),
  ('dec-04-3', 'proj-04', 'exec-04-2', 'Reviews & Recommendations', 'architecture', 'Recommendation algorithm?', 'Collaborative filtering with fallback to popularity', 'Cold-start problem handled by popular items, transitions to CF with data.', '["ml","recommendations"]', 'active', datetime('now','-8 days')),
  ('dec-05-1', 'proj-05', 'exec-05-1', 'Data Collection', 'technology', 'Metrics storage backend?', 'Prometheus with Thanos for long-term', 'Native Prometheus for real-time, Thanos sidecar for historical queries.', '["monitoring","prometheus"]', 'active', datetime('now','-23 days')),
  ('dec-05-2', 'proj-05', 'exec-05-1', 'Dashboard UI', 'design', 'Charting library for dashboards?', 'Apache ECharts', 'Better performance than Recharts for large datasets, native WebGL mode.', '["charts","frontend"]', 'active', datetime('now','-17 days')),
  ('dec-05-3', 'proj-05', 'exec-05-2', 'Alerting & Integrations', 'technology', 'Incident management tool?', 'PagerDuty', 'Better on-call rotation support and escalation policies than Opsgenie.', '["alerting","incidents"]', 'active', datetime('now','-9 days')),
  ('dec-06-1', 'proj-06', 'exec-06-1', 'Sentiment Analysis', 'architecture', 'Which transformer model?', 'Fine-tuned DistilBERT', '3x faster inference than BERT-base with only 3% accuracy loss. Critical for real-time.', '["ml","nlp","performance"]', 'active', datetime('now','-38 days')),
  ('dec-06-2', 'proj-06', 'exec-06-1', 'Trend Detection', 'architecture', 'Time-series anomaly detection?', 'Prophet + custom Z-score', 'Prophet for seasonal trends, Z-score for sudden spikes. Ensemble approach.', '["ml","time-series"]', 'active', datetime('now','-30 days')),
  ('dec-06-3', 'proj-06', 'exec-06-2', 'Dashboard & Reports', 'technology', 'PDF report generation?', 'Puppeteer with HTML templates', 'Render React charts to HTML, capture with Puppeteer. Same charts in dashboard and PDF.', '["reporting","pdf"]', 'active', datetime('now','-20 days')),
  ('dec-07-1', 'proj-07', 'exec-07-1', 'Core Messaging', 'architecture', 'Real-time transport?', 'Phoenix Channels (WebSocket)', 'Built-in Elixir/OTP for fault tolerance, native PubSub with Phoenix Presence.', '["real-time","elixir"]', 'active', datetime('now','-17 days')),
  ('dec-07-2', 'proj-07', 'exec-07-1', 'Core Messaging', 'design', 'Message storage?', 'PostgreSQL with partitioning', 'Partition by channel_id for fast queries. TimescaleDB considered but overkill.', '["database","postgresql"]', 'active', datetime('now','-15 days')),
  ('dec-07-3', 'proj-07', 'exec-07-2', 'Channels & Threads', 'design', 'Thread model?', 'Slack-style parent/reply threading', 'Users familiar with pattern. Thread replies stored as messages with parent_id FK.', '["ux","data-model"]', 'active', datetime('now','-10 days')),
  ('dec-08-1', 'proj-08', 'exec-08-1', 'Content Models', 'architecture', 'Content model approach?', 'Schema-driven with JSON Schema validation', 'Dynamic fields defined in JSON Schema. Runtime validation, no migration needed for new types.', '["schema","cms","flexibility"]', 'active', datetime('now','-34 days')),
  ('dec-08-2', 'proj-08', 'exec-08-1', 'Page Builder', 'technology', 'Frontend framework for builder?', 'Inertia.js with Vue 3', 'SSR benefits of Laravel with SPA feel. Simpler than separate API + SPA.', '["frontend","vue","inertia"]', 'active', datetime('now','-29 days')),
  ('dec-08-3', 'proj-08', 'exec-08-2', 'Asset Management', 'technology', 'Image CDN provider?', 'Cloudflare Images', 'On-the-fly transforms, global CDN, simple pricing. Better than self-hosted imgproxy.', '["cdn","images","performance"]', 'active', datetime('now','-17 days')),
  ('dec-09-1', 'proj-09', 'exec-09-1', 'Data Processing', 'technology', 'Data versioning tool?', 'DVC (Data Version Control)', 'Git-like versioning for datasets. Works with S3 remote storage. Team already knows Git.', '["data","versioning","mlops"]', 'active', datetime('now','-37 days')),
  ('dec-09-2', 'proj-09', 'exec-09-1', 'Model Training', 'technology', 'Experiment tracking?', 'Self-hosted MLflow', 'Full control, no vendor lock-in. Weights & Biases considered but cost prohibitive at scale.', '["mlops","experiment-tracking"]', 'active', datetime('now','-28 days')),
  ('dec-09-3', 'proj-09', 'exec-09-2', 'Monitoring & Drift', 'architecture', 'Drift detection method?', 'Population Stability Index + KL Divergence', 'PSI for feature drift, KL divergence for prediction drift. Alert when PSI > 0.2.', '["ml","monitoring","drift"]', 'active', datetime('now','-13 days')),
  ('dec-10-1', 'proj-10', 'exec-10-1', 'MQTT Broker', 'architecture', 'MQTT broker: build or buy?', 'Custom in Rust', 'Need deep integration with auth system and custom routing. EMQX too heavy for our needs.', '["mqtt","architecture","rust"]', 'active', datetime('now','-14 days')),
  ('dec-10-2', 'proj-10', 'exec-10-1', 'MQTT Broker', 'technology', 'QoS level support?', 'QoS 0 and 1 only', 'QoS 2 exactly-once adds significant complexity. QoS 1 at-least-once sufficient for sensors.', '["mqtt","protocol"]', 'active', datetime('now','-12 days')),
  ('dec-10-3', 'proj-10', 'exec-10-2', 'Time-Series Storage', 'technology', 'Time-series database?', 'TimescaleDB', 'PostgreSQL compatibility, automatic partitioning, continuous aggregates for dashboards.', '["database","timeseries"]', 'active', datetime('now','-9 days')),
  ('dec-11-1', 'proj-11', 'exec-11-1', 'Employee Directory', 'technology', 'Org chart visualization?', 'D3.js tree layout', 'Flexible enough for complex org structures. GoJS considered but expensive license.', '["visualization","frontend"]', 'active', datetime('now','-56 days')),
  ('dec-11-2', 'proj-11', 'exec-11-1', 'Leave & Attendance', 'design', 'Approval workflow engine?', 'State machine with AASM gem', 'Clear state transitions, audit trail built-in. Temporal considered but overkill.', '["workflow","state-machine"]', 'active', datetime('now','-48 days')),
  ('dec-11-3', 'proj-11', 'exec-11-2', 'Performance Reviews', 'design', 'Review cycle frequency?', 'Quarterly with continuous feedback', 'Quarterly formal reviews + anytime peer feedback. Matches modern HR practices.', '["hr","process"]', 'active', datetime('now','-39 days')),
  ('dec-12-1', 'proj-12', 'exec-12-1', 'Transcoding Pipeline', 'technology', 'Streaming protocol?', 'HLS over DASH', 'Native iOS support, broader CDN support. DASH better for DRM but HLS+FairPlay sufficient.', '["streaming","video","protocol"]', 'active', datetime('now','-20 days')),
  ('dec-12-2', 'proj-12', 'exec-12-1', 'Transcoding Pipeline', 'architecture', 'Transcoding architecture?', 'Worker queue with S3 events', 'S3 upload triggers SQS message, worker picks up and transcodes. Auto-scales with queue depth.', '["architecture","queue","scaling"]', 'active', datetime('now','-19 days')),
  ('dec-12-3', 'proj-12', 'exec-12-2', 'Playback & CDN', 'technology', 'CDN provider?', 'CloudFront with Lambda@Edge', 'Token-based URL signing at edge, geo-routing, and custom cache behavior.', '["cdn","security"]', 'active', datetime('now','-13 days')),
  ('dec-13-1', 'proj-13', 'exec-13-1', 'Exchange Connectors', 'technology', 'Exchange API library?', 'ccxt (unified crypto exchange API)', '100+ exchanges supported. Saves months of per-exchange integration work.', '["crypto","api","integration"]', 'active', datetime('now','-26 days')),
  ('dec-13-2', 'proj-13', 'exec-13-1', 'Strategy Framework', 'architecture', 'Strategy definition approach?', 'Custom DSL with Python AST', 'Safer than eval(), validates strategy logic at parse time. Compiles to executable plan.', '["dsl","trading","safety"]', 'active', datetime('now','-18 days')),
  ('dec-13-3', 'proj-13', 'exec-13-2', 'Live Trading', 'design', 'Risk management approach?', 'Per-trade stop-loss + portfolio-level drawdown limit', 'Hard stops at 2% per trade, 10% portfolio drawdown triggers full shutdown.', '["risk","trading","safety"]', 'active', datetime('now','-10 days')),
  ('dec-14-1', 'proj-14', 'exec-14-1', 'Workout Engine', 'technology', 'Exercise data source?', 'Open-source wger API + custom additions', 'Free exercise database with images. Supplement with curated custom exercises.', '["data","fitness","api"]', 'active', datetime('now','-19 days')),
  ('dec-14-2', 'proj-14', 'exec-14-1', 'Progress & Analytics', 'design', 'Progress visualization approach?', 'Line charts with trend lines + PR badges', 'Simple charts for strength progression, badges for personal records. Gamification lite.', '["ux","charts","gamification"]', 'active', datetime('now','-10 days')),
  ('dec-14-3', 'proj-14', 'exec-14-2', 'Social & Gamification', 'architecture', 'Social feed architecture?', 'Fan-out on write to Firebase', 'Pre-compute feeds on activity write. Scales reads infinitely. Fine for our user count.', '["social","firebase","scaling"]', 'active', datetime('now','-5 days')),
  ('dec-15-1', 'proj-15', 'exec-15-1', 'CRDT Document Model', 'architecture', 'CRDT library?', 'Y.js', 'Best performance benchmarks, active maintenance, Tiptap integration. Automerge considered but slower.', '["crdt","real-time","collaboration"]', 'active', datetime('now','-11 days')),
  ('dec-15-2', 'proj-15', 'exec-15-1', 'CRDT Document Model', 'technology', 'Rich text editor framework?', 'Tiptap (ProseMirror-based)', 'Extensible schema, Y.js binding available, better DX than Slate.js.', '["editor","frontend"]', 'active', datetime('now','-10 days')),
  ('dec-15-3', 'proj-15', 'exec-15-1', 'CRDT Document Model', 'architecture', 'Sync transport?', 'WebRTC with WebSocket fallback', 'P2P for low latency, server relay when peers unavailable. Hybrid approach.', '["networking","real-time","webrtc"]', 'active', datetime('now','-8 days'));

-- ============================================================================
-- KNOWLEDGE (3 per project = 36 new)
-- ============================================================================

INSERT OR IGNORE INTO knowledge (id, project_id, title, content, category, source, metadata, created_at) VALUES
  ('kn-04-1', 'proj-04', 'Meilisearch index optimization', 'Use filterable and sortable attributes sparingly — each adds index size. Batch document updates instead of single writes. Rebuild index on schema changes.', 'learning', 'Phase 1: Product Catalog', '{"tags":["search","meilisearch","performance"]}', datetime('now','-28 days')),
  ('kn-04-2', 'proj-04', 'Stripe idempotency keys', 'Always pass idempotency keys for payment intents. Use order ID as key. Stripe deduplicates requests within 24 hours. Critical for retry scenarios.', 'reference', 'Phase 2: Cart & Checkout', '{"tags":["stripe","payments","reliability"]}', datetime('now','-22 days')),
  ('kn-04-3', 'proj-04', 'Next.js ISR for product pages', 'Use Incremental Static Regeneration with 60s revalidation for product pages. Serves stale while revalidating. On-demand revalidation for price changes via webhook.', 'learning', 'Phase 1: Product Catalog', '{"tags":["nextjs","performance","caching"]}', datetime('now','-27 days')),
  ('kn-05-1', 'proj-05', 'Go Fiber middleware ordering', 'Middleware execution order matters: Logger → Recover → CORS → Auth → RateLimit. Recover must be early to catch panics. Auth before rate limit to avoid counting unauthenticated requests.', 'learning', 'Phase 1: Data Collection', '{"tags":["go","fiber","middleware"]}', datetime('now','-24 days')),
  ('kn-05-2', 'proj-05', 'Prometheus cardinality limits', 'Keep label cardinality under 10K unique combinations per metric. High-cardinality labels (user IDs, request paths) cause memory explosion. Use histogram buckets instead.', 'fact', 'Phase 1: Data Collection', '{"tags":["prometheus","monitoring","performance"]}', datetime('now','-22 days')),
  ('kn-05-3', 'proj-05', 'Slack webhook message formatting', 'Use Block Kit for rich Slack messages. Markdown in text blocks, not attachments (deprecated). Rate limit: 1 message per second per webhook URL.', 'reference', 'Phase 3: Alerting & Integrations', '{"tags":["slack","webhooks","integration"]}', datetime('now','-10 days')),
  ('kn-06-1', 'proj-06', 'Twitter API v2 rate limits', 'App-level: 300 requests/15 min for search, 500/15 min for tweet lookup. Use streaming endpoint for real-time — more efficient than polling. Bearer token required.', 'fact', 'Phase 1: Data Ingestion', '{"tags":["twitter","api","rate-limits"]}', datetime('now','-44 days')),
  ('kn-06-2', 'proj-06', 'DistilBERT fine-tuning tips', 'Freeze embeddings for first 2 epochs, then unfreeze. Learning rate 2e-5 with linear warmup over 10% of steps. Mixed precision (fp16) cuts training time in half.', 'learning', 'Phase 2: Sentiment Analysis', '{"tags":["ml","nlp","fine-tuning"]}', datetime('now','-37 days')),
  ('kn-06-3', 'proj-06', 'Redis Streams for event pipeline', 'Use Redis Streams over Pub/Sub for guaranteed delivery. Consumer groups for parallel processing. XACK after processing to track progress. XPENDING for failed message recovery.', 'decision', 'Phase 1: Data Ingestion', '{"tags":["redis","streaming","events"]}', datetime('now','-42 days')),
  ('kn-07-1', 'proj-07', 'Phoenix Channel backpressure', 'Use channel rate limiting to prevent message flooding. Configure max_rate in channel_join/3. Drop excess messages with priority queue — typing indicators lower than chat messages.', 'learning', 'Phase 1: Core Messaging', '{"tags":["elixir","phoenix","performance"]}', datetime('now','-16 days')),
  ('kn-07-2', 'proj-07', 'ETS table for presence cache', 'Phoenix Presence uses CRDT under the hood. Cache presence state in ETS for O(1) lookups. Avoid querying Presence tracker on every message render.', 'learning', 'Phase 1: Core Messaging', '{"tags":["elixir","ets","presence"]}', datetime('now','-14 days')),
  ('kn-07-3', 'proj-07', 'PostgreSQL full-text search config', 'Use tsvector with GIN index for message search. Custom dictionary with chat-specific stop words. Rank results by ts_rank_cd with normalization.', 'reference', 'Phase 2: Channels & Threads', '{"tags":["postgresql","search","full-text"]}', datetime('now','-10 days')),
  ('kn-08-1', 'proj-08', 'Laravel polymorphic relationships for CMS', 'Use morphTo/morphMany for content blocks that can belong to pages, posts, or layouts. Single blocks table with blockable_type and blockable_id columns.', 'learning', 'Phase 1: Content Models', '{"tags":["laravel","orm","polymorphism"]}', datetime('now','-33 days')),
  ('kn-08-2', 'proj-08', 'Vue 3 drag-and-drop with vuedraggable', 'Use vuedraggable (SortableJS wrapper) for page builder. Clone mode for component palette, move mode for canvas. Handle nested drag with group property.', 'reference', 'Phase 2: Page Builder', '{"tags":["vue","drag-drop","ui"]}', datetime('now','-27 days')),
  ('kn-08-3', 'proj-08', 'Cloudflare Images transforms', 'URL-based transforms: /cdn-cgi/image/width=800,format=auto/. Auto format serves WebP to supported browsers. Resize on-the-fly without pre-generating variants.', 'reference', 'Phase 3: Asset Management', '{"tags":["cdn","images","optimization"]}', datetime('now','-16 days')),
  ('kn-09-1', 'proj-09', 'DVC remote storage setup', 'Use S3 as DVC remote with versioned bucket. Run dvc push after data changes, dvc pull to restore. Lock file (dvc.lock) tracks exact data hashes — commit to git.', 'reference', 'Phase 1: Data Processing', '{"tags":["dvc","data","versioning"]}', datetime('now','-36 days')),
  ('kn-09-2', 'proj-09', 'Optuna pruning for hyperparameter search', 'Enable MedianPruner to stop unpromising trials early. Saves 40-60% compute. Set n_warmup_steps to 10 to avoid premature pruning of slow starters.', 'learning', 'Phase 2: Model Training', '{"tags":["optuna","hyperparameters","optimization"]}', datetime('now','-29 days')),
  ('kn-09-3', 'proj-09', 'FastAPI model server batching', 'Use asyncio.Queue for request batching. Collect requests for 50ms or until batch_size=32, whichever first. GPU utilization jumps from 30% to 85% with batching.', 'learning', 'Phase 3: Model Serving', '{"tags":["fastapi","inference","batching"]}', datetime('now','-21 days')),
  ('kn-10-1', 'proj-10', 'MQTT message size limits', 'Keep payloads under 4KB for sensor data. Use MessagePack instead of JSON — 30% smaller. Compress larger payloads with zstd. Broker rejects messages over configurable max.', 'fact', 'Phase 1: MQTT Broker', '{"tags":["mqtt","protocol","optimization"]}', datetime('now','-13 days')),
  ('kn-10-2', 'proj-10', 'TimescaleDB chunk interval', 'Set chunk_time_interval to 1 day for sensor data with second-level granularity. Smaller chunks = faster queries on recent data. Enable compression on chunks older than 7 days.', 'learning', 'Phase 2: Time-Series Storage', '{"tags":["timescaledb","performance","storage"]}', datetime('now','-9 days')),
  ('kn-10-3', 'proj-10', 'Rust async MQTT with rumqttc', 'Use rumqttc crate for async MQTT client. EventLoop::poll() drives the connection. Handle Incoming::Publish in a spawned task to avoid blocking the event loop.', 'reference', 'Phase 1: MQTT Broker', '{"tags":["rust","mqtt","async"]}', datetime('now','-12 days')),
  ('kn-11-1', 'proj-11', 'Rails AASM gem for workflow states', 'Define states and transitions with AASM. after_commit callbacks for side effects (emails, notifications). Guard clauses prevent invalid transitions.', 'reference', 'Phase 2: Leave & Attendance', '{"tags":["rails","state-machine","workflow"]}', datetime('now','-49 days')),
  ('kn-11-2', 'proj-11', 'D3.js org chart performance', 'Use canvas rendering for orgs with 500+ nodes. SVG works fine under 200. Lazy-load deep tree branches. Collapse all but first 3 levels on initial render.', 'learning', 'Phase 1: Employee Directory', '{"tags":["d3","visualization","performance"]}', datetime('now','-55 days')),
  ('kn-11-3', 'proj-11', '360 feedback anonymization', 'Hash reviewer IDs before storing feedback. Manager sees aggregate scores, not individual responses. Minimum 3 reviewers before showing results to prevent identification.', 'decision', 'Phase 3: Performance Reviews', '{"tags":["privacy","hr","design"]}', datetime('now','-37 days')),
  ('kn-12-1', 'proj-12', 'FFmpeg HLS encoding presets', 'Use -preset fast for live, -preset slow for VOD. Segment duration 6s for balance of startup time and encoding efficiency. Include I-frame playlist for trick play.', 'reference', 'Phase 1: Transcoding Pipeline', '{"tags":["ffmpeg","hls","encoding"]}', datetime('now','-21 days')),
  ('kn-12-2', 'proj-12', 'Adaptive bitrate ladder', 'Standard ladder: 360p@800kbps, 480p@1.5Mbps, 720p@3Mbps, 1080p@6Mbps. Use per-title encoding to optimize — simple content needs fewer bits. CRF-based quality targeting.', 'fact', 'Phase 1: Transcoding Pipeline', '{"tags":["video","abr","quality"]}', datetime('now','-19 days')),
  ('kn-12-3', 'proj-12', 'CloudFront signed URLs', 'Use signed URLs with custom policy for time-limited access. Key pair stored in Secrets Manager. Lambda@Edge generates signatures at edge for low latency.', 'reference', 'Phase 2: Playback & CDN', '{"tags":["cloudfront","security","cdn"]}', datetime('now','-12 days')),
  ('kn-13-1', 'proj-13', 'ccxt unified API quirks', 'Exchange-specific params via params dict in ccxt calls. Rate limits vary per exchange — use built-in rate limiter. Binance requires recvWindow param for time-sensitive operations.', 'learning', 'Phase 1: Exchange Connectors', '{"tags":["ccxt","crypto","api"]}', datetime('now','-25 days')),
  ('kn-13-2', 'proj-13', 'Backtesting look-ahead bias', 'Never use future data in backtests. Shift indicators by 1 bar. Use point-in-time data snapshots. Survivorship bias: include delisted assets in historical data.', 'fact', 'Phase 2: Strategy Framework', '{"tags":["backtesting","bias","trading"]}', datetime('now','-19 days')),
  ('kn-13-3', 'proj-13', 'Position sizing with Kelly Criterion', 'Modified Kelly at 25% (quarter Kelly) for conservative sizing. Full Kelly too aggressive for real trading. Calculate edge from backtest win rate and average win/loss ratio.', 'decision', 'Phase 3: Live Trading', '{"tags":["risk","position-sizing","trading"]}', datetime('now','-10 days')),
  ('kn-14-1', 'proj-14', 'Flutter workout timer with isolates', 'Run timer logic in a separate isolate to prevent UI jank during animations. Use ReceivePort for communication. Platform timer plugin for background operation.', 'learning', 'Phase 1: Workout Engine', '{"tags":["flutter","isolates","performance"]}', datetime('now','-17 days')),
  ('kn-14-2', 'proj-14', 'Firebase Firestore offline persistence', 'Enable offline persistence with cacheSizeBytes: CACHE_SIZE_UNLIMITED. Pending writes survive app restart. Listen for snapshot metadata.fromCache to show sync status.', 'reference', 'Phase 1: Workout Engine', '{"tags":["firebase","firestore","offline"]}', datetime('now','-15 days')),
  ('kn-14-3', 'proj-14', 'GraphQL subscriptions for social feed', 'Use GraphQL subscriptions over WebSocket for real-time feed updates. Apollo Client handles reconnection. Server-side filtering by friend list to reduce payload.', 'learning', 'Phase 3: Social & Gamification', '{"tags":["graphql","real-time","social"]}', datetime('now','-5 days')),
  ('kn-15-1', 'proj-15', 'Y.js document encoding', 'Use Y.encodeStateAsUpdate() for incremental sync, Y.encodeStateVector() + Y.encodeStateAsUpdate(doc, sv) for differential sync. Binary format much smaller than JSON.', 'reference', 'Phase 1: CRDT Document Model', '{"tags":["yjs","crdt","encoding"]}', datetime('now','-11 days')),
  ('kn-15-2', 'proj-15', 'Tiptap extension architecture', 'Each block type is a Tiptap extension. Extensions define schema, commands, input rules, and keyboard shortcuts. Use ProseMirror NodeView for complex interactive blocks.', 'learning', 'Phase 1: CRDT Document Model', '{"tags":["tiptap","prosemirror","architecture"]}', datetime('now','-9 days')),
  ('kn-15-3', 'proj-15', 'WebRTC signaling with WebSocket', 'Lightweight signaling server relays SDP offers/answers and ICE candidates. Use unique room IDs (document IDs) for routing. STUN for NAT traversal, TURN as relay fallback.', 'reference', 'Phase 2: Real-time Sync', '{"tags":["webrtc","signaling","networking"]}', datetime('now','-7 days'));

-- ============================================================================
-- TEST RUNS (1 per project = 12 new)
-- ============================================================================

INSERT OR IGNORE INTO test_runs (id, project_id, execution_id, phase, total_tests, passed, failed, skipped, duration_ms, coverage_lines, coverage_branches, coverage_functions, started_at, completed_at, created_at) VALUES
  ('tr-04-1', 'proj-04', 'exec-04-1', 'Order Management', 48, 46, 1, 1, 9800, 82.1, 68.5, 86.3, datetime('now','-14 days'), datetime('now','-14 days','+10 seconds'), datetime('now','-14 days')),
  ('tr-05-1', 'proj-05', 'exec-05-1', 'Dashboard UI', 35, 34, 0, 1, 5200, 79.4, 64.2, 83.1, datetime('now','-14 days'), datetime('now','-14 days','+5 seconds'), datetime('now','-14 days')),
  ('tr-06-1', 'proj-06', 'exec-06-2', 'Dashboard & Reports', 62, 61, 1, 0, 14500, 88.2, 74.8, 91.0, datetime('now','-16 days'), datetime('now','-16 days','+14 seconds'), datetime('now','-16 days')),
  ('tr-07-1', 'proj-07', 'exec-07-1', 'Core Messaging', 28, 27, 0, 1, 4300, 76.5, 62.0, 80.2, datetime('now','-13 days'), datetime('now','-13 days','+4 seconds'), datetime('now','-13 days')),
  ('tr-08-1', 'proj-08', 'exec-08-1', 'Page Builder', 45, 43, 2, 0, 11200, 80.8, 66.3, 84.5, datetime('now','-22 days'), datetime('now','-22 days','+11 seconds'), datetime('now','-22 days')),
  ('tr-09-1', 'proj-09', 'exec-09-1', 'Model Serving', 52, 50, 1, 1, 8900, 85.6, 72.1, 89.0, datetime('now','-18 days'), datetime('now','-18 days','+9 seconds'), datetime('now','-18 days')),
  ('tr-10-1', 'proj-10', 'exec-10-1', 'MQTT Broker', 40, 38, 2, 0, 3100, 84.3, 70.5, 87.8, datetime('now','-10 days'), datetime('now','-10 days','+3 seconds'), datetime('now','-10 days')),
  ('tr-11-1', 'proj-11', 'exec-11-2', 'Performance Reviews', 55, 55, 0, 0, 7800, 90.2, 78.4, 93.1, datetime('now','-32 days'), datetime('now','-32 days','+8 seconds'), datetime('now','-32 days')),
  ('tr-12-1', 'proj-12', 'exec-12-1', 'Transcoding Pipeline', 22, 21, 1, 0, 6400, 74.8, 58.3, 78.5, datetime('now','-16 days'), datetime('now','-16 days','+6 seconds'), datetime('now','-16 days')),
  ('tr-13-1', 'proj-13', 'exec-13-1', 'Strategy Framework', 58, 56, 1, 1, 12100, 86.9, 73.2, 90.5, datetime('now','-14 days'), datetime('now','-14 days','+12 seconds'), datetime('now','-14 days')),
  ('tr-14-1', 'proj-14', 'exec-14-1', 'Progress & Analytics', 32, 31, 0, 1, 5600, 78.3, 63.5, 82.0, datetime('now','-7 days'), datetime('now','-7 days','+6 seconds'), datetime('now','-7 days')),
  ('tr-15-1', 'proj-15', 'exec-15-1', 'CRDT Document Model', 25, 23, 2, 0, 3800, 72.1, 56.8, 76.4, datetime('now','-8 days'), datetime('now','-8 days','+4 seconds'), datetime('now','-8 days'));

-- ============================================================================
-- TEST RESULTS (4 per test run = 48 new)
-- ============================================================================

INSERT OR IGNORE INTO test_results (id, test_run_id, test_name, test_file, status, duration_ms, error_message) VALUES
  ('tres-04-01', 'tr-04-1', 'creates order from cart', 'tests/orders.test.ts', 'passed', 180, NULL),
  ('tres-04-02', 'tr-04-1', 'sends confirmation email', 'tests/orders.test.ts', 'passed', 420, NULL),
  ('tres-04-03', 'tr-04-1', 'handles payment failure gracefully', 'tests/checkout.test.ts', 'failed', 2100, 'Expected redirect to /checkout/error but got /500'),
  ('tres-04-04', 'tr-04-1', 'admin can update order status', 'tests/admin.test.ts', 'passed', 95, NULL),
  ('tres-05-01', 'tr-05-1', 'renders pipeline status cards', 'tests/dashboard.test.tsx', 'passed', 150, NULL),
  ('tres-05-02', 'tr-05-1', 'deploy history shows last 20', 'tests/deploys.test.tsx', 'passed', 200, NULL),
  ('tres-05-03', 'tr-05-1', 'metric sparklines update live', 'tests/metrics.test.tsx', 'passed', 380, NULL),
  ('tres-05-04', 'tr-05-1', 'empty state for no pipelines', 'tests/dashboard.test.tsx', 'skipped', 0, NULL),
  ('tres-06-01', 'tr-06-1', 'sentiment scores within [-1, 1]', 'tests/sentiment.test.py', 'passed', 520, NULL),
  ('tres-06-02', 'tr-06-1', 'trend detection catches spike', 'tests/trends.test.py', 'passed', 890, NULL),
  ('tres-06-03', 'tr-06-1', 'PDF report generates correctly', 'tests/reports.test.py', 'failed', 3200, 'Puppeteer timeout: chart not rendered within 10s'),
  ('tres-06-04', 'tr-06-1', 'dashboard filters by date range', 'tests/dashboard.test.tsx', 'passed', 250, NULL),
  ('tres-07-01', 'tr-07-1', 'message delivery under 100ms', 'test/channels_test.exs', 'passed', 45, NULL),
  ('tres-07-02', 'tr-07-1', 'presence tracks join/leave', 'test/presence_test.exs', 'passed', 80, NULL),
  ('tres-07-03', 'tr-07-1', 'handles 1000 concurrent users', 'test/load_test.exs', 'passed', 2800, NULL),
  ('tres-07-04', 'tr-07-1', 'rate limits message flooding', 'test/channels_test.exs', 'skipped', 0, NULL),
  ('tres-08-01', 'tr-08-1', 'drag reorders components', 'tests/page-builder.test.ts', 'passed', 420, NULL),
  ('tres-08-02', 'tr-08-1', 'renders 20+ block types', 'tests/components.test.ts', 'passed', 680, NULL),
  ('tres-08-03', 'tr-08-1', 'responsive preview matches', 'tests/preview.test.ts', 'failed', 1500, 'Mobile preview width off by 20px'),
  ('tres-08-04', 'tr-08-1', 'nested blocks depth limit', 'tests/page-builder.test.ts', 'failed', 320, 'Stack overflow on 10-level nesting'),
  ('tres-09-01', 'tr-09-1', 'model serves predictions', 'tests/test_serving.py', 'passed', 150, NULL),
  ('tres-09-02', 'tr-09-1', 'batching improves throughput', 'tests/test_batching.py', 'passed', 2400, NULL),
  ('tres-09-03', 'tr-09-1', 'A/B routing splits traffic', 'tests/test_ab.py', 'passed', 380, NULL),
  ('tres-09-04', 'tr-09-1', 'handles model not found', 'tests/test_serving.py', 'failed', 90, 'Returns 500 instead of 404 for missing model'),
  ('tres-10-01', 'tr-10-1', 'authenticates MQTT client', 'tests/auth.rs', 'passed', 25, NULL),
  ('tres-10-02', 'tr-10-1', 'routes topic messages', 'tests/routing.rs', 'passed', 18, NULL),
  ('tres-10-03', 'tr-10-1', 'QoS 1 delivery guarantee', 'tests/qos.rs', 'failed', 1200, 'Message not re-delivered after PUBACK timeout'),
  ('tres-10-04', 'tr-10-1', 'rejects oversized payload', 'tests/limits.rs', 'failed', 15, 'Accepts 8KB payload when limit is 4KB'),
  ('tres-11-01', 'tr-11-1', 'review cycle completes', 'spec/models/review_spec.rb', 'passed', 280, NULL),
  ('tres-11-02', 'tr-11-1', '360 feedback aggregates scores', 'spec/models/feedback_spec.rb', 'passed', 150, NULL),
  ('tres-11-03', 'tr-11-1', 'goal progress calculates correctly', 'spec/models/goal_spec.rb', 'passed', 95, NULL),
  ('tres-11-04', 'tr-11-1', 'anonymized feedback cannot identify reviewer', 'spec/models/feedback_spec.rb', 'passed', 120, NULL),
  ('tres-12-01', 'tr-12-1', 'transcodes to 4 quality levels', 'tests/transcode.test.ts', 'passed', 4200, NULL),
  ('tres-12-02', 'tr-12-1', 'generates HLS manifest', 'tests/manifest.test.ts', 'passed', 380, NULL),
  ('tres-12-03', 'tr-12-1', 'extracts thumbnail at 25%', 'tests/thumbnail.test.ts', 'passed', 950, NULL),
  ('tres-12-04', 'tr-12-1', 'handles corrupt video file', 'tests/transcode.test.ts', 'failed', 120, 'Unhandled FFmpeg exit code 1 on corrupt input'),
  ('tres-13-01', 'tr-13-1', 'backtest matches historical P&L', 'tests/test_backtest.py', 'passed', 1800, NULL),
  ('tres-13-02', 'tr-13-1', 'strategy DSL parses correctly', 'tests/test_dsl.py', 'passed', 45, NULL),
  ('tres-13-03', 'tr-13-1', 'Sharpe ratio calculation', 'tests/test_metrics.py', 'passed', 30, NULL),
  ('tres-13-04', 'tr-13-1', 'rejects look-ahead strategy', 'tests/test_backtest.py', 'failed', 500, 'Strategy accessed future bar data without detection'),
  ('tres-14-01', 'tr-14-1', 'logs workout with sets/reps', 'test/workout_test.dart', 'passed', 120, NULL),
  ('tres-14-02', 'tr-14-1', 'progression chart renders', 'test/charts_test.dart', 'passed', 280, NULL),
  ('tres-14-03', 'tr-14-1', 'personal record detection', 'test/pr_test.dart', 'passed', 65, NULL),
  ('tres-14-04', 'tr-14-1', 'offline workout sync', 'test/sync_test.dart', 'skipped', 0, NULL),
  ('tres-15-01', 'tr-15-1', 'concurrent edits merge', 'tests/crdt.test.ts', 'passed', 250, NULL),
  ('tres-15-02', 'tr-15-1', 'undo/redo with Y.js', 'tests/undo.test.ts', 'passed', 180, NULL),
  ('tres-15-03', 'tr-15-1', 'table block insert/delete rows', 'tests/blocks.test.ts', 'failed', 420, 'Row deletion causes orphaned cells in Y.Map'),
  ('tres-15-04', 'tr-15-1', 'embed block renders preview', 'tests/blocks.test.ts', 'failed', 350, 'OEmbed fetch fails for YouTube URLs');

-- ============================================================================
-- NOTIFICATIONS (1 per project = 12 new)
-- ============================================================================

INSERT OR IGNORE INTO notifications (id, project_id, notification_type, title, message, link, read, created_at) VALUES
  ('notif-04-1', 'proj-04', 'phase_completed', 'Order Management Complete', 'E-Commerce phase 3 done — moving to recommendations', '/project/proj-04', 1, datetime('now','-14 days')),
  ('notif-05-1', 'proj-05', 'execution_completed', 'Dashboard Beta Ready', 'DevOps Dashboard execution #1 completed — $17.60', '/project/proj-05', 1, datetime('now','-14 days')),
  ('notif-06-1', 'proj-06', 'execution_completed', 'Analytics v2.0 Done', 'All 4 phases completed — project fully delivered', '/project/proj-06', 1, datetime('now','-16 days')),
  ('notif-07-1', 'proj-07', 'task_started', 'Threading In Progress', 'Threaded reply support started for chat MVP', '/project/proj-07', 0, datetime('now','-9 days')),
  ('notif-08-1', 'proj-08', 'test_failure', 'Page Builder Tests Failed', '2 failures: preview width and nesting depth', '/project/proj-08', 0, datetime('now','-22 days')),
  ('notif-09-1', 'proj-09', 'cost_warning', 'ML Pipeline Cost Alert', 'Training pipeline at $43.90 of $50.00 warn threshold', '/project/proj-09', 0, datetime('now','-18 days')),
  ('notif-10-1', 'proj-10', 'test_failure', 'MQTT Tests Failed', 'QoS delivery and payload size tests failing', '/project/proj-10', 0, datetime('now','-10 days')),
  ('notif-11-1', 'proj-11', 'execution_completed', 'HR Portal Complete', 'All phases delivered — project archived', '/project/proj-11', 1, datetime('now','-32 days')),
  ('notif-12-1', 'proj-12', 'phase_completed', 'Transcoding Ready', 'Video transcoding pipeline operational', '/project/proj-12', 1, datetime('now','-16 days')),
  ('notif-13-1', 'proj-13', 'decision_made', 'Risk Controls Set', 'Hard stop-loss and drawdown limits configured', '/project/proj-13', 0, datetime('now','-10 days')),
  ('notif-14-1', 'proj-14', 'execution_completed', 'Workout Tracking Live', 'Core fitness tracking features ready for testing', '/project/proj-14', 1, datetime('now','-7 days')),
  ('notif-15-1', 'proj-15', 'execution_paused', 'Editor Paused', 'Waiting for WebRTC architecture decision', '/project/proj-15', 0, datetime('now','-5 days'));

-- ============================================================================
-- CHECKPOINTS (1-2 per project = 15 new)
-- ============================================================================

INSERT OR IGNORE INTO checkpoints (id, project_id, execution_id, state, phase, task, context_usage_pct, name, created_at) VALUES
  ('cp-04-1', 'proj-04', 'exec-04-1', 'running', 'Cart & Checkout', 'Stripe checkout integration', 55.2, 'Stripe session flow working', datetime('now','-22 days')),
  ('cp-05-1', 'proj-05', 'exec-05-2', 'running', 'Alerting & Integrations', 'Custom alert thresholds', 42.0, 'Alert config UI scaffolded', datetime('now','-9 days')),
  ('cp-06-1', 'proj-06', 'exec-06-1', 'running', 'Sentiment Analysis', 'Transformer model fine-tuning', 68.5, 'Model accuracy at 92%', datetime('now','-37 days')),
  ('cp-07-1', 'proj-07', 'exec-07-2', 'running', 'Channels & Threads', 'Threaded reply support', 38.0, 'Thread model designed', datetime('now','-9 days')),
  ('cp-08-1', 'proj-08', 'exec-08-1', 'running', 'Page Builder', 'Drag-and-drop component canvas', 72.3, 'Canvas interaction complete', datetime('now','-26 days')),
  ('cp-09-1', 'proj-09', 'exec-09-1', 'running', 'Model Training', 'Distributed training orchestrator', 58.0, 'Multi-GPU training working', datetime('now','-31 days')),
  ('cp-09-2', 'proj-09', 'exec-09-2', 'running', 'Monitoring & Drift', 'Data drift detection', 32.5, 'PSI calculation implemented', datetime('now','-12 days')),
  ('cp-10-1', 'proj-10', 'exec-10-1', 'running', 'MQTT Broker', 'Device auth & ACL', 48.0, 'Token-based auth working', datetime('now','-12 days')),
  ('cp-12-1', 'proj-12', 'exec-12-2', 'running', 'Playback & CDN', 'CloudFront CDN integration', 35.0, 'Distribution created', datetime('now','-11 days')),
  ('cp-13-1', 'proj-13', 'exec-13-1', 'running', 'Strategy Framework', 'Backtesting engine core', 62.8, 'Backtest loop validated', datetime('now','-19 days')),
  ('cp-13-2', 'proj-13', 'exec-13-2', 'running', 'Live Trading', 'Risk management engine', 40.0, 'Stop-loss logic coded', datetime('now','-9 days')),
  ('cp-14-1', 'proj-14', 'exec-14-1', 'running', 'Progress & Analytics', 'Strength progression charts', 52.0, 'Chart components rendering', datetime('now','-10 days')),
  ('cp-15-1', 'proj-15', 'exec-15-1', 'running', 'CRDT Document Model', 'Rich text editor (Tiptap)', 45.5, 'Basic editing working', datetime('now','-9 days'));

-- ============================================================================
-- COST THRESHOLDS (1 per project = 12 new)
-- ============================================================================

INSERT OR IGNORE INTO cost_thresholds (id, project_id, warn_cost, alert_cost, stop_cost, enabled) VALUES
  ('ct-04', 'proj-04', 20.00, 45.00, 75.00, 1),
  ('ct-05', 'proj-05', 10.00, 25.00, 40.00, 1),
  ('ct-06', 'proj-06', 25.00, 50.00, 80.00, 1),
  ('ct-07', 'proj-07', 12.00, 30.00, 50.00, 1),
  ('ct-08', 'proj-08', 18.00, 40.00, 65.00, 1),
  ('ct-09', 'proj-09', 30.00, 55.00, 90.00, 1),
  ('ct-10', 'proj-10', 10.00, 22.00, 35.00, 1),
  ('ct-11', 'proj-11', 15.00, 35.00, 55.00, 0),
  ('ct-12', 'proj-12', 15.00, 35.00, 60.00, 1),
  ('ct-13', 'proj-13', 20.00, 40.00, 70.00, 1),
  ('ct-14', 'proj-14', 15.00, 32.00, 50.00, 1),
  ('ct-15', 'proj-15', 18.00, 38.00, 60.00, 1);
