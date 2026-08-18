---
spike: 003
name: gsd-pi-artifact-surface
type: standard
validates: "Given a gsd-pi project, when we enumerate DB-vs-file artifacts and map them to VCCA's data model, then we know the parse strategy + rough effort vs gsd.rs"
verdict: VALIDATED
related: [001, 002]
tags: [gsd-pi, schema, projection, effort]
---

# Spike 003: gsd-pi-artifact-surface

## What This Validates
What does a gsd-pi project actually expose (DB vs files), how does it map to VCCA's existing data
model/UI, and roughly how much work is VCCA support?

## Findings — two surfaces, not one
gsd-pi keeps the **canonical state in `.gsd/gsd.db`** (SQLite/WAL) AND **flushes file projections
to disk** after every workflow mutation via `projection-flush.ts → renderAllProjections`
(`workflow-projections.ts`):

| Surface | What | VCCA read path |
|---------|------|----------------|
| **DB (canonical)** | `.gsd/gsd.db`: `milestones/slices/tasks`, `artifacts.full_content` ({ROADMAP,PLAN,SUMMARY,CONTEXT,...}), `requirements`, `decisions`, `runtime_kv` (state), verification/assessments/quality_gates, memories/*, audit_* | Spike 001 — rusqlite read-only ✓ |
| **File projections** | `.gsd/STATE.md`, `ROADMAP.md`, `PROJECT.md`, `REQUIREMENTS.md`, `KNOWLEDGE.md`, `metrics.json`, `milestones/` | reuse/adapt existing `gsd2.rs` file parser |
| **Other on-disk** | `.gsd/event-log.jsonl`, `.gsd/worktrees/`, `.gsd/agent/`, `.gsd/runtime/`, `.gsd/auto.lock` | optional (worktrees map to existing UI) |

**Key realization:** the file projections overlap the artifact set VCCA's **old `gsd2.rs` already
parses** (`.gsd/STATE.md`, `.gsd/metrics.json`, `.gsd/milestones/...`, `.gsd/KNOWLEDGE.md`). The
`milestones/slices/tasks` model maps **1:1** onto VCCA's existing GSD-2 UI (milestones/slices/tasks
tabs + visualizer + health). The preserved-UI decision from v1.2 pays off directly here.

## Mapping to VCCA's model
- gsd-pi milestone → VCCA "milestone"; slice → "slice"; task → "task" (terminology already exists).
- `artifacts` rows / projected `.md` → VCCA's per-node doc viewers (ROADMAP/PLAN/SUMMARY/CONTEXT).
- `runtime_kv` (global/milestone) → VCCA's state/health surface (replaces STATE.md frontmatter).

## Two integration strategies (the build fork)
- **A. File-projection reader (lower effort):** adapt `gsd2.rs` to gsd-pi's *current* projected
  formats + Spike-002 external-state resolution. Reuses parser + UI. Caveats: verify projected
  format vs the old GSD-2 shape (drift likely), and projection freshness (flushed on mutation
  exit — current for a normally-running project, possibly stale after a crash).
- **B. DB reader (higher fidelity):** read `gsd.db` directly (Spike 001). Always-current,
  complete, no projection-freshness concern; costs a `sha2` crate + a new sqlite reader mapping
  ~25 tables, plus the WAL/-shm caveat from Spike 001.

## Rough effort vs gsd.rs
Moderate, and **smaller than v1.0's original GSD-2 build** because the UI already exists and one
read path reuses `gsd2.rs`. Net-new work: external-state/symlink resolution (002), `sha2` dep,
and either format-reconciliation (A) or a DB reader + table→model mapping (B). Recommend B for
fidelity, with A as a fast fallback — decide during phase planning.

## Results
**VERDICT: VALIDATED.** gsd-pi is readable by VCCA via two complementary surfaces; both land on
the existing GSD-2 UI. This is a coherent, scoped capability — best as its **own milestone (v1.3)**
rather than bolted onto v1.2. It also argues against *deleting* `gsd2.rs` in v1.2 Phase 13:
prefer **quarantine/freeze** so its file-reading logic survives as a basis for strategy A.
