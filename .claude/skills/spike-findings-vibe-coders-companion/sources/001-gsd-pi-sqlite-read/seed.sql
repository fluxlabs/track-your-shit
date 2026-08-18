-- Representative gsd-pi project state
INSERT INTO schema_version VALUES (42, '2026-06-15T00:00:00Z');

INSERT INTO milestones (id, title, status, created_at, vision, success_criteria, sequence) VALUES
 ('M001', 'Core engine', 'active', '2026-06-10', 'Autonomous build loop', '["loop runs","resumes"]', 1);

INSERT INTO slices (milestone_id, id, title, status, risk, goal, full_summary_md, sequence) VALUES
 ('M001', 'S01', 'Spec ingestion', 'complete', 'high', 'Parse spec into units', '# Summary\nIngestion works end to end.', 1),
 ('M001', 'S02', 'Executor loop', 'in_progress', 'high', 'Run units to completion', '', 2);

INSERT INTO tasks (milestone_id, slice_id, id, title, status, one_liner) VALUES
 ('M001','S01','T01','Parse spec.md','complete','Reads spec, emits unit graph'),
 ('M001','S02','T01','Dispatch unit','in_progress','Sends unit to coding agent');

INSERT INTO artifacts (path, artifact_type, milestone_id, slice_id, full_content, imported_at) VALUES
 ('M001/ROADMAP.md','ROADMAP','M001',NULL,'# Roadmap\nM001 → S01, S02','2026-06-11'),
 ('M001/S01/PLAN.md','PLAN','M001','S01','# Plan S01\nParse the spec.','2026-06-11'),
 ('M001/S01/SUMMARY.md','SUMMARY','M001','S01','# Summary S01\nDone.','2026-06-12');

INSERT INTO requirements (id, class, status, description, full_content) VALUES
 ('REQ-1','functional','validated','System ingests a spec file','User can point gsd-pi at spec.md');

INSERT INTO decisions (id, decision, choice, rationale) VALUES
 ('D-1','Storage backend','SQLite single-writer','Crash-safe, queryable, single source of truth');

INSERT INTO runtime_kv (scope, scope_id, key, value_json) VALUES
 ('global','','active_milestone','"M001"'),
 ('global','','status','"executing"'),
 ('milestone','M001','current_slice','"S02"');
