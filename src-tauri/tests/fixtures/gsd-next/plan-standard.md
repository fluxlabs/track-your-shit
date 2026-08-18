---
phase: 11-schema-fidelity-and-cleanup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/commands/gsd_common.rs
  - src-tauri/src/commands/mod.rs
  - src-tauri/tests/fixtures/gsd-next/state.md
autonomous: true
requirements: [SCHM-01, SCHM-02]
user_setup: []
---

<objective>
Establish the foundation for Phase 11 schema work: extract gsd.rs-side parsing helpers into a new
shared module (gsd_common.rs), seed checked-in fixtures from the authoritative gsd-core@next
templates, and add fixture-backed fidelity tests that encode the target schema.

Purpose: Plan 02 (schema fidelity + path projection) consumes this shared module, the known-key
tables, and the fixtures. The fidelity tests fail RED here and turn GREEN once Plan 02 lands.
Output: gsd_common.rs (extracted helpers + drift-signal helper + known-key tables), six fixtures,
and a fidelity test module.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Seed gsd-core@next fixtures</name>
  <files>src-tauri/tests/fixtures/gsd-next/state.md, src-tauri/tests/fixtures/gsd-next/plan-standard.md</files>
  <action>Create six fixture files seeded from gsd-core@next templates with concrete values.</action>
  <verify>test -f src-tauri/tests/fixtures/gsd-next/state.md</verify>
  <acceptance_criteria>
    All six fixtures exist with required fields.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Create gsd_common.rs shared module</name>
  <files>src-tauri/src/commands/gsd_common.rs, src-tauri/src/commands/mod.rs, src-tauri/src/commands/gsd.rs</files>
  <action>Extract helpers from gsd.rs into gsd_common.rs and register in mod.rs.</action>
  <verify>cargo build --manifest-path src-tauri/Cargo.toml</verify>
  <acceptance_criteria>
    gsd_common.rs exists with all helpers; cargo build passes.
  </acceptance_criteria>
</task>

</tasks>
