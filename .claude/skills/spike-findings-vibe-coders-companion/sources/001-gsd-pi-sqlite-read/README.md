---
spike: 001
name: gsd-pi-sqlite-read
type: standard
validates: "Given a gsd-pi .gsd/gsd.db (WAL), when VCCA opens it read-only via rusqlite, then it can query milestone/slice/task/artifact/state rows without violating the single-writer invariant"
verdict: VALIDATED
related: [002, 003]
tags: [gsd-pi, sqlite, rusqlite, wal, read-only, integration]
---

# Spike 001: gsd-pi-sqlite-read

## What This Validates
Given a gsd-pi `.gsd/gsd.db` (WAL mode), when VCCA opens it **read-only** with its existing
rusqlite pattern, then it can query the milestone/slice/task hierarchy, artifact docs, and
runtime state — without writing (preserving gsd-pi's single-writer invariant).

## Research
- gsd-pi DB owner: `src/resources/extensions/gsd/db-base-schema.ts` (+ `db-runtime-kv-schema.ts`).
  Driver: `better-sqlite3` / `node:sqlite` (`DatabaseSync`). Journal mode: **WAL** (shared-WAL
  contract; `wal_checkpoint(TRUNCATE)` in `db-migration-backup.ts`).
- Schema is rich & relational: `milestones / slices / tasks` (the M/S/T hierarchy), `artifacts`
  (planning docs stored as rows via `full_content` + `artifact_type` in {ROADMAP,PLAN,SUMMARY,
  CONTEXT,RESEARCH,UAT,PROJECT,REQUIREMENTS,...}), `requirements`, `decisions`, `runtime_kv`
  (scope-partitioned state: global/worker/milestone — replaces STATE.md), plus
  verification_evidence, assessments, quality_gates, memories/*, audit_* tables.
- VCCA already reads SQLite read-only: `src-tauri/src/db/mod.rs:74` uses
  `OpenFlags::SQLITE_OPEN_READ_ONLY | NO_MUTEX | URI` on rusqlite 0.32 (`bundled`). The proof
  reuses those exact flags.

## How to Run
```bash
# build a WAL gsd.db from gsd-pi's real schema + sample data
sqlite3 gsd.db "PRAGMA journal_mode=WAL;"; sqlite3 gsd.db < schema.sql; sqlite3 gsd.db < seed.sql
# compile + run the rusqlite read-only proof
cd proof && cargo build && cd ..
proof/target/debug/proof gsd.db
```

## What to Expect
Read-only connection prints the M/S/T hierarchy, artifact docs with `full_content` lengths,
`runtime_kv` state, and decision/requirement counts; `RESULT: OK`.

## Investigation Trail
1. Extracted real schema from `db-base-schema.ts`; built faithful `schema.sql` + `seed.sql`.
2. Wrote `proof/` (rusqlite 0.32 bundled) replicating VCCA's exact read-only OpenFlags.
3. **Scenario 1 — clean WAL db:** OK. All rows read (hierarchy, artifacts, state). ✓
4. **Scenario 2 — live writer + un-checkpointed `-wal`:** OK. Read-only saw the writer's
   un-checkpointed `M002` and the live `status` flip → read-only readers see in-flight WAL data
   *when a writer holds the db open* (the `-shm` exists). ✓
5. **Scenario 4 — copied/unclean `.gsd` (`-wal` non-empty, NO live writer):** open succeeded but
   returned **0 rows / stale view**. A read-only connection **cannot create the `-shm`**, so it
   ignores the `-wal` and reads only the main db file. ⚠️ This is the WAL gotcha.

## Results
**VERDICT: VALIDATED (with one caveat).**

VCCA can read gsd-pi's `gsd.db` read-only with its *existing* rusqlite setup — no new deps, no
writes, single-writer invariant respected. The full relational model (M/S/T, artifacts as rows,
runtime_kv state) is queryable.

**Caveat — WAL/`-shm` edge case:** a read-only reader of a db whose `-wal` holds un-checkpointed
data **with no live writer present** reads a stale/empty view (it can't build `-shm`).
- Normal cases are fine: gsd-pi running (writer present → reads live data) and gsd-pi cleanly
  exited (SQLite truncates `-wal` on last close → all data in main db, reads fine).
- The stale case arises only on unclean exit or copying a `.gsd` mid-run.
- **Mitigations to evaluate in the real build:** (a) detect a non-empty `-wal` with no writer and
  surface a "checkpoint needed / state may be stale" indicator; (b) optionally open read-write
  with `PRAGMA query_only=ON` to build `-shm` and replay WAL without writing data (needs care vs
  the single-writer contract); (c) `immutable=1` does NOT help (it also ignores `-wal`).

**Impact on remaining spikes:** read feasibility confirmed → 002 (path resolution) and 003
(artifact surface / effort) are worth running.
