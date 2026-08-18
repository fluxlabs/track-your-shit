---
name: spike-findings-vibe-coders-companion
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building gsd-pi support in VCCA (Vibe Coders Companion App). Auto-loaded during implementation work.
---

<context>
## Project: vibe-coders-companion (VCCA)

VCCA reads GSD project state and renders it. These spikes verified whether/how VCCA can support
**open-gsd/gsd-pi** projects, whose `.gsd/` is a DB-backed (`.gsd/gsd.db`, SQLite/WAL) format with
an external symlinked state layout (`.gsd → ~/.gsd/projects/<hash>/`) — distinct from VCCA's retired
GSD-2 `.gsd/` file format. Findings feed the planned **v1.3 gsd-pi support** milestone.

Spike session wrapped: 2026-06-15
</context>

<requirements>
## Requirements

- **Read-only** — never write to gsd-pi state (single-writer invariant on `gsd.db`).
- Reuse VCCA's existing **rusqlite 0.32 (`bundled`)**; avoid heavy new deps (one small add: `sha2`).
- Render into the **existing GSD-2 UI** (milestones/slices/tasks tabs, visualizer, health) — data model maps 1:1.
- **Freeze, don't delete** `gsd2.rs`'s `.gsd/` file readers — they are the basis for the file-projection read strategy.
- gsd-pi support is its **own v1.3 milestone**, not a v1.2 phase.
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| gsd-pi read integration | references/gsd-pi-read-integration.md | VCCA can read gsd-pi read-only (DB via existing rusqlite, or file projections via frozen gsd2.rs); resolve state dir via `.gsd` symlink or `sha256[:12]` identity; WAL/-shm stale-read is the one gotcha |

## Source Files

Original spike source files are preserved in `sources/` (001 rusqlite proof + schema, 002 hash
replication proof, 003 artifact-surface analysis).
</findings_index>

<metadata>
## Processed Spikes

- 001-gsd-pi-sqlite-read
- 002-gsd-pi-state-resolution
- 003-gsd-pi-artifact-surface
</metadata>
