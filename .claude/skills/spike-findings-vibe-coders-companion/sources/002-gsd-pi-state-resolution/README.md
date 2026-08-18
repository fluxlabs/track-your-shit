---
spike: 002
name: gsd-pi-state-resolution
type: standard
validates: "Given a project with .gsd -> ~/.gsd/projects/<hash>/, when VCCA replicates repo-identity hashing + env overrides, then it locates the correct external state dir & gsd.db"
verdict: VALIDATED
related: [001, 003]
tags: [gsd-pi, paths, repo-identity, sha256]
---

# Spike 002: gsd-pi-state-resolution

## What This Validates
Given a gsd-pi project whose `.gsd` is a symlink to `~/.gsd/projects/<hash>/`, when VCCA resolves
the real state directory, then it lands on the correct `gsd.db`.

## Research
Source: `src/resources/extensions/gsd/repo-identity.ts` + `gsd-home.ts`.

**`repoIdentity(basePath)`** (deterministic, stable across moves/worktrees):
1. `GSD_PROJECT_ID` env → used verbatim if set.
2. else `remoteUrl = (git config --get remote.origin.url).trim()` → `sha256(remoteUrl).hex[:12]`.
3. else local-only → `sha256("\n" + gitRoot).hex[:12]` (note the leading newline). Local repos
   also drop a `.gsd-id` marker for recovery after directory moves.

**External dir:** `externalProjectsRoot = (GSD_STATE_DIR || GSD_HOME || ~/.gsd) + "/projects"`;
state dir = `externalProjectsRoot + "/" + hash`. (`gsdHome()` = `$GSD_HOME` or `~/.gsd`.)

Two resolution paths available to VCCA:
- **Simplest:** read the `<project>/.gsd` symlink target directly (it points straight at the
  state dir). Works whenever the symlink exists.
- **Robust fallback:** recompute the hash (above) — needed if the symlink is absent/broken, on
  Windows (no symlink), or to honor `.gsd-id` marker recovery.

## How to Run
```bash
bash proof.sh   # needs node (gsd-pi reference) + openssl (independent check)
```

## What to Expect
For each input, the gsd-pi (node `createHash`) hash equals the independent (openssl) hash →
proves the algorithm is trivially replicable in Rust (`sha2` crate). Path-precedence lines show
`GSD_STATE_DIR` > `GSD_HOME`/`~/.gsd`, and `GSD_PROJECT_ID` overriding the hash entirely.

## Investigation Trail
1. Extracted the exact algorithm from `repo-identity.ts` (lines 311-356) incl. the `.trim()` on
   the remote URL and the leading-newline local input.
2. Built `proof.sh` computing `sha256[:12]` via node and via openssl for 3 input forms.
3. Ran it: **all three MATCH** (remote-https `d311c3f098d1`, remote-ssh `b227fa6fa783`, local
   `738781ab1919`). Path precedence rendered correctly.

## Results
**VERDICT: VALIDATED.** VCCA can resolve a gsd-pi project's external state dir deterministically.
Requirements for the real build:
- Add a SHA-256 (e.g. `sha2` crate — small, pure Rust); VCCA has none today.
- Shell out to `git config --get remote.origin.url` (VCCA already runs git commands).
- Honor env precedence: `GSD_PROJECT_ID` > `GSD_STATE_DIR` > `GSD_HOME` > `~/.gsd`.
- Prefer reading the `.gsd` symlink target; fall back to hashing (+ `.gsd-id` marker) when absent.

**Impact:** combined with Spike 001 (read the db), VCCA has a complete read path: resolve dir →
open `gsd.db` read-only → query.
