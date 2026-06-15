# Phase 11: Schema Fidelity & Cleanup - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Make VCCA's .planning/ parser (src-tauri/src/commands/gsd.rs) faithfully read everything
gsd-core@next currently produces: correct frontmatter/file shapes, workstream-aware path
resolution per ADR-0006/ADR-0004, current file-naming conventions — and clear the accumulated
technical debt (hardcoded dev path, VCCA naming reconciliation). Maps to SCHM-01..04 + FIX-01..03.

Not in this phase: surfacing new artifact types (Phase 12), any gsd2.rs/.gsd/ work (Phase 13
freeze), gsd-pi support (v1.3), and any multi-workstream browsing UI (deferred).

</domain>

<decisions>
## Implementation Decisions

### Workstream resolution depth (SCHM-04)
- **D-01:** Resolve the active workstream only. Introduce a single helper
  resolve_gsd_path(project_path, workstream_id: Option<_>, subpath) and route the flat
  .planning/ joins through it.
- **D-02:** Resolution follows ADR-0006 precedence: explicit workstream > env workstream > env
  project > root, honoring the active-workstream pointer (session-scoped > shared) from ADR-0004.
- **D-03:** No multi-workstream switcher UI this phase.

### Schema-drift resilience (SCHM-01/02)
- **D-04:** Hybrid lenient+visible. Parsing is forward-compatible — unknown/new frontmatter fields
  never cause a hard failure. Unrecognized fields logged via tracing and surfaced as a non-fatal
  signal. Never silently drop data the UI already knows how to show.

### Shared-helper consolidation
- **D-05:** Extract the gsd.rs-side parsing helpers (parse_frontmatter, get_project_path, and path
  logic) into a shared module (commands/gsd_common.rs). Do NOT touch the frozen gsd2.rs copies.

### Drift regression guard (SCHM-01)
- **D-06:** Leave a checked-in fixture test. Snapshot representative gsd-core@next templates
  into test fixtures (src-tauri/.../tests/fixtures/gsd-next/) and assert gsd.rs parses them
  with no dropped/mismatched fields. Makes "no field mismatches vs next templates" self-verifying.

### Claude's Discretion
- Exact module name/location for the extracted shared parser, fixture layout, and the
  tracing/log channel for drift signals.

</decisions>

<specifics>
## Specific Ideas

- Fixture-based fidelity test seeded from real gsd-core@next templates is the linchpin of
  SCHM-01 — it converts "stay aligned with upstream" from a manual chore into an enforced
  invariant.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- .planning/REQUIREMENTS.md — SCHM-01..04, FIX-01..03 (the phase's requirements)
- .planning/ROADMAP.md — Phase 11 goal + success criteria

### Authoritative upstream schema (gsd-core@next)
- /home/dave/repos/gsd-core-next-sweep/gsd-core/templates/ — current file shapes VCCA must parse
- /home/dave/repos/gsd-core-next-sweep/docs/adr/0006-planning-path-projection-module.md
- /home/dave/repos/gsd-core-next-sweep/docs/adr/0004-worktree-workstream-seam-module.md

### Code map (this repo)
- .planning/codebase/CONCERNS.md — exact line numbers

</canonical_refs>

<deferred>
## Deferred Ideas

- Multi-workstream browsing/switcher UI — new capability; future phase/milestone.
- Consolidating gsd2.rs duplicated helpers — deferred to when gsd2.rs is repurposed for gsd-pi
  (v1.3); Phase 13 freezes it, so it stays untouched now.

</deferred>
