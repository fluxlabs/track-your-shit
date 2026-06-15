# gsd-pi Read Integration

Implementation blueprint for reading **open-gsd/gsd-pi** projects into VCCA. Verified by spikes
001–003 (all VALIDATED) on 2026-06-15.

## Requirements
- **Read-only.** Never write to gsd-pi state — gsd-pi enforces a single-writer invariant on `gsd.db`.
- Reuse VCCA's existing **rusqlite 0.32 (`bundled`, `modern_sqlite`)**; no heavy new deps.
- Render into the **existing GSD-2 UI** (milestones/slices/tasks tabs, visualizer, health) — the data model maps 1:1.
- Do **not delete** `gsd2.rs`'s `.gsd/` file readers — they are the basis for strategy A below.

## What gsd-pi exposes (two surfaces)
gsd-pi stores `.gsd/` as a **symlink** → `~/.gsd/projects/<hash>/` (external state). Inside:
- **Canonical DB:** `.gsd/gsd.db` (SQLite, **WAL**). Tables incl. `milestones`, `slices`, `tasks`,
  `artifacts(path, artifact_type, milestone_id, slice_id, full_content, …)`, `requirements`,
  `decisions`, `runtime_kv(scope, scope_id, key, value_json)` (state), plus verification/assessment/
  quality_gate/memory/audit tables. Schema source: gsd-pi `src/resources/extensions/gsd/db-base-schema.ts`.
- **File projections** (flushed from DB on every workflow mutation via `renderAllProjections`):
  `.gsd/STATE.md`, `ROADMAP.md`, `PROJECT.md`, `REQUIREMENTS.md`, `KNOWLEDGE.md`, `metrics.json`,
  `milestones/` — overlapping what VCCA's old `gsd2.rs` already parses.

## How to Build It

### Step 1 — Resolve the state directory (Spike 002)
gsd-pi identity (`repo-identity.ts`), in precedence order:
1. `GSD_PROJECT_ID` env → use verbatim.
2. remote repo → `sha256( (git config --get remote.origin.url).trim() ).hex[:12]`
3. local-only → `sha256( "\n" + gitRoot ).hex[:12]`  (note the leading newline)

State dir = `(GSD_STATE_DIR || GSD_HOME || ~/.gsd) + "/projects/" + hash`.

**Simplest path:** read the `<project>/.gsd` symlink target directly — it points at the state dir.
**Fallback (symlink absent / Windows / moved repo):** recompute the hash above (add the `sha2` crate;
VCCA has no SHA dep today), and honor the `.gsd-id` marker for recovery. Verified replicable in
`sources/002-gsd-pi-state-resolution/proof.sh` (node == openssl).

### Step 2 — Read the DB read-only (Spike 001 — strategy B, recommended)
Reuse VCCA's exact flags from `src-tauri/src/db/mod.rs`:
```rust
let flags = OpenFlags::SQLITE_OPEN_READ_ONLY
    | OpenFlags::SQLITE_OPEN_NO_MUTEX
    | OpenFlags::SQLITE_OPEN_URI;
let conn = Connection::open_with_flags(path_to_gsd_db, flags)?;
```
Then query the M/S/T hierarchy + `artifacts.full_content` + `runtime_kv`. Working example:
`sources/001-gsd-pi-sqlite-read/proof/src/main.rs` (queries milestones⋈slices, artifacts by type,
runtime_kv state). Map tables → VCCA models: milestone→milestone, slice→slice, task→task,
artifact rows → per-node doc viewers, runtime_kv (global/milestone) → state/health surface.

### Step 2-alt — Read file projections (strategy A — fast fallback)
Adapt the **frozen** `gsd2.rs` file readers to gsd-pi's *current* projected formats. Lower effort
(reuses parser + UI) but verify format drift vs the old GSD-2 shape and projection freshness.

## What to Avoid
- **Don't open read-only and assume fresh data on a static/copied `.gsd` with a non-empty `-wal`
  and no live writer.** A read-only connection can't build the `-shm`, so it **silently ignores the
  `-wal`** and returns a stale/empty view (Spike 001, Scenario 4). `immutable=1` does NOT fix this
  (also ignores `-wal`).
- Don't write to `gsd.db` (breaks single-writer). If you must replay an un-checkpointed WAL,
  consider a read-write open with `PRAGMA query_only=ON` — but weigh it against the single-writer
  contract; prefer detecting a non-empty `-wal`+no-writer and surfacing a "state may be stale" hint.
- Don't delete `gsd2.rs` — freeze it; its file readers seed strategy A.

## Constraints
- `gsd.db` is **WAL** mode. Read-only reads work fully when gsd-pi is **running** (writer present →
  `-shm` exists → in-flight WAL visible) or **cleanly exited** (SQLite truncates `-wal` on last close →
  all data in main db). The stale case is only unclean-exit / mid-run file copy.
- `.gsd` is a **symlink** to `~/.gsd/projects/<hash>/` (no project-root symlink on Windows).
- Needs a `sha2` crate for identity hashing (only if not relying solely on the symlink target).
- Scope this as its **own v1.3 milestone** — it's independent and sizable.

## Origin
Synthesized from spikes: 001, 002, 003.
Source files: `sources/001-gsd-pi-sqlite-read/`, `sources/002-gsd-pi-state-resolution/`, `sources/003-gsd-pi-artifact-surface/`.
