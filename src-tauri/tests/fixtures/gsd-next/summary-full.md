# Phase 11 Plan 01: GSD Common Module + Fixtures Summary
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

---
phase: 11-schema-fidelity-and-cleanup
plan: 01
subsystem: parser
tags: [rust, gsd, parser, frontmatter, fixtures, testing]

# Dependency graph
requires:
  - phase: 10-security-and-automation
    provides: worktree agent branch validation and security automation
provides:
  - Shared gsd_common.rs module with extracted parsing helpers
  - Six gsd-core@next fixture files for regression testing
  - Fidelity test scaffold (RED until Plan 02)
affects: [11-02-schema-fidelity, 11-03-doc-cleanup, 12-artifact-coverage]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-module-extraction, fixture-based-regression-guard, include_str-ci-safe-fixtures]

key-files:
  created: [src-tauri/src/commands/gsd_common.rs, src-tauri/tests/fixtures/gsd-next/state.md, src-tauri/tests/fixtures/gsd-next/plan-standard.md]
  modified: [src-tauri/src/commands/mod.rs, src-tauri/src/commands/gsd.rs]

key-decisions:
  - "Extract gsd.rs helpers verbatim to gsd_common.rs; no behavior changes in Plan 01"
  - "Mark Plan-02-dependent fidelity tests as #[ignore] to keep Plan 01 suite green"

patterns-established:
  - "include_str!-based fixture tests: compile-time embedding, CI-safe, no filesystem assumptions"
  - "warn_unknown_fields drift detection: tracing::warn on novel keys, never panic"

requirements-completed: [SCHM-01]

# Metrics
duration: 35min
completed: 2026-06-14
status: complete
---

## Accomplishments

- Extracted five parsing helpers from gsd.rs into gsd_common.rs
- Added warn_unknown_fields drift-signal helper and three KNOWN_*_KEYS tables
- Registered gsd_common module in commands/mod.rs
- Seeded six gsd-core@next fixture files with concrete field values
- Scaffolded six fidelity tests (three non-ignored pass green; three ignored pending Plan 02)
- gsd2.rs untouched (Phase 13 freeze preserved)

## Task Commits

1. **Task 1: Seed gsd-core@next fixtures** - chore(11-01): seed gsd-next fixtures
2. **Task 2: Create gsd_common.rs** - feat(11-01): extract helpers to gsd_common.rs
3. **Task 3: Fidelity test scaffold** - test(11-01): add fidelity test scaffold

## Decisions Made

- Extracted helpers verbatim — no schema changes in Plan 01 (those land in Plan 02)
- Marked Plan-02-dependent tests with #[ignore] rather than commenting out

## Deviations from Plan

None - plan executed exactly as written.
