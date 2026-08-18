-- Faithful subset of gsd-pi's .gsd/gsd.db schema
-- Source: gsd-pi src/resources/extensions/gsd/db-base-schema.ts + db-runtime-kv-schema.ts
-- Captures the tables VCCA would need: milestones/slices/tasks hierarchy,
-- artifacts (docs as rows), requirements, decisions, runtime_kv (state).

CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL, applied_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  depends_on TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT '',
  completed_at TEXT DEFAULT NULL,
  vision TEXT NOT NULL DEFAULT '',
  success_criteria TEXT NOT NULL DEFAULT '[]',
  sequence INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS slices (
  milestone_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  risk TEXT NOT NULL DEFAULT 'medium',
  goal TEXT NOT NULL DEFAULT '',
  full_summary_md TEXT NOT NULL DEFAULT '',
  sequence INTEGER DEFAULT 0,
  PRIMARY KEY (milestone_id, id),
  FOREIGN KEY (milestone_id) REFERENCES milestones(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  milestone_id TEXT NOT NULL,
  slice_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  one_liner TEXT NOT NULL DEFAULT '',
  completed_at TEXT DEFAULT NULL,
  PRIMARY KEY (milestone_id, slice_id, id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  path TEXT PRIMARY KEY,
  artifact_type TEXT NOT NULL DEFAULT '',
  milestone_id TEXT DEFAULT NULL,
  slice_id TEXT DEFAULT NULL,
  task_id TEXT DEFAULT NULL,
  full_content TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  content_hash TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY,
  class TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  full_content TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS decisions (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  decision TEXT NOT NULL DEFAULT '',
  choice TEXT NOT NULL DEFAULT '',
  rationale TEXT NOT NULL DEFAULT ''
);

-- runtime_kv: scope-partitioned state (global/worker/milestone). Replaces STATE.md.
CREATE TABLE IF NOT EXISTS runtime_kv (
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (scope, scope_id, key)
);
