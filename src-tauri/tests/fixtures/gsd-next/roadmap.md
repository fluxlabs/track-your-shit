# Roadmap: VCCA (Vibe Coders Companion App)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-03-01)
- ✅ **v1.1 Security & Polish** - Phases 5-10 (shipped 2026-06-01)
- 🚧 **v1.2 Schema Fidelity** - Phases 11-12 (in progress)
- 📋 **v2.0 Workstream Browsing** - Phases 13-15 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-03-01</summary>

### Phase 1: GSD-2 Backend Foundation
**Goal**: Establish Tauri Rust backend with GSD file parsing
**Plans**: 3 plans

Plans:
- [x] 01-01: Database schema + DbPool setup
- [x] 01-02: gsd.rs parsing commands
- [x] 01-03: Project CRUD and IPC wiring

### Phase 2: Core Frontend
**Goal**: React frontend with TanStack Query and shadcn/ui
**Plans**: 4 plans

Plans:
- [x] 02-01: Page scaffolding and routing
- [x] 02-02: Dashboard and project views
- [x] 02-03: Terminal integration
- [x] 02-04: Settings and notifications

### Phase 2.1: Critical Fix — IPC Timeout (INSERTED)
**Goal**: Fix IPC timeout that caused terminal sessions to drop after 30s
**Depends on**: Phase 2
**Success Criteria** (what must be TRUE):
  1. Terminal sessions remain stable for sessions longer than 30 seconds
**Plans**: 1 plan

Plans:
- [x] 02.1-01: Increase IPC timeout + add keepalive heartbeat

</details>

### 🚧 v1.2 Schema Fidelity (In Progress)

**Milestone Goal:** Make the .planning/ parser match gsd-core@next exactly

#### Phase 11: Schema Fidelity & Cleanup
**Goal**: Fix all frontmatter field gaps between gsd.rs and gsd-core@next templates
**Depends on**: Phase 10
**Requirements**: [SCHM-01, SCHM-02, SCHM-03, SCHM-04, FIX-01, FIX-02, FIX-03]
**Success Criteria** (what must be TRUE):
  1. STATE.md progress block values are extracted and surfaced to the UI
  2. PLAN.md wave/depends_on/requirements fields are parsed
  3. SUMMARY.md requirements-completed field is extracted
  4. No hardcoded dev paths remain in gsd.rs
**Plans**: 3 plans

Plans:
- [ ] 11-01: Shared parser module + fixtures + fidelity test scaffold
- [ ] 11-02: Schema fidelity fixes (progress, wave, requirements-completed)
- [ ] 11-03: Doc cleanup + FIX items

#### Phase 11.1: Critical Fix — Decimal Phase Handling (INSERTED)
**Goal**: Update find_phase_dir to handle decimal phase names like 02.1-hotfix
**Depends on**: Phase 11
**Success Criteria** (what must be TRUE):
  1. Directory 02.1-critical-fix is resolved correctly without colliding with 02-normal-work
**Plans**: 1 plan

Plans:
- [ ] 11.1-01: Update find_phase_dir regex + add test

#### Phase 12: Artifact Coverage
**Goal**: Surface archived milestone plans and summaries in VCCA
**Depends on**: Phase 11
**Requirements**: [ART-01, ART-02]
**Success Criteria** (what must be TRUE):
  1. Plans in milestones/vX.Y-phases/ are visible in VCCA
  2. Archived summaries searchable by phase
**Plans**: 2 plans

Plans:
- [ ] 12-01: Walk archived milestone dirs for plans
- [ ] 12-02: UI for archived artifact browsing

## Progress

**Execution Order:**
Phases execute in numeric order: 11 → 11.1 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. GSD-2 Backend Foundation | v1.0 | 3/3 | Complete | 2026-03-01 |
| 2. Core Frontend | v1.0 | 4/4 | Complete | 2026-03-15 |
| 11. Schema Fidelity & Cleanup | v1.2 | 0/3 | In progress | - |
| 11.1. Decimal Phase Fix | v1.2 | 0/1 | Not started | - |
| 12. Artifact Coverage | v1.2 | 0/2 | Not started | - |
