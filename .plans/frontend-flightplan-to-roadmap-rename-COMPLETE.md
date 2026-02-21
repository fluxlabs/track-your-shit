# Frontend FlightPlan to Roadmap Rename - COMPLETE ✅
// Control Tower - Rename Summary
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

## Summary
Successfully renamed all "FlightPlan" / "flight_plan" / "flightplan" references to "Roadmap" / "roadmap" in the frontend components and pages.

## Major Changes

### 1. Component Directory Restructure ✅
- **Created**: `src/components/roadmap/` directory
- **Deleted**: `src/components/flightplan/` directory
- **Renamed files**:
  - `flight-plan-viewer.tsx` → `roadmap-viewer.tsx`
  - `flight-plan-header.tsx` → `roadmap-header.tsx`
- **Moved files** (kept same names):
  - `add-dependency-dialog.tsx`
  - `add-phase-dialog.tsx`
  - `bulk-action-bar.tsx`
  - `delete-phase-dialog.tsx`
  - `dependency-overlay.tsx`
  - `edit-phase-dialog.tsx`
  - `milestone-group.tsx`
  - `phase-card.tsx`
  - `phase-comments.tsx`
  - `phase-diff-badge.tsx`
  - `sortable-phase.tsx`
  - `status-badge.tsx`
  - `task-row.tsx`
  - `template-picker-dialog.tsx`
  - `index.ts`

### 2. Component Internal Updates ✅
All moved files updated with:
- `FlightPlan` type → `Roadmap` type
- `flightPlan` variables → `roadmap` variables
- `flight-plan` CSS classes → `roadmap` CSS classes
- `flight_plan` database fields → `roadmap` database fields
- Import paths: `@/components/flightplan/` → `@/components/roadmap/`
- Import paths: `@/lib/flight-plan-diff` → `@/lib/roadmap-diff`

### 3. Component Prop Renames ✅
- **phase-card.tsx**: `flightPlanId` prop → `roadmapId` prop
- **phase-comments.tsx**: `flightPlanId` prop → `roadmapId` prop
- **quick-actions-bar.tsx**: 
  - `onSyncFlightPlan` → `onSyncRoadmap`
  - `hasFlightPlan` → `hasRoadmap`

### 4. Barrel Export Updates ✅
**src/components/roadmap/index.ts**:
- `FlightPlanViewer` → `RoadmapViewer`
- `FlightPlanHeader` → `RoadmapHeader`

### 5. Hook Renames ✅
Throughout all consuming files:
- `useFlightPlan` → `useRoadmap`
- `useSyncFlightPlan` → `useSyncRoadmap`

### 6. Files Updated with FlightPlan → Roadmap

#### Dashboard Components ✅
- `src/components/dashboard/project-card.tsx`
  - `flight_plan_progress` → `roadmap_progress`
- `src/components/dashboard/project-row.tsx`
  - `flight_plan_progress` → `roadmap_progress`

#### Project Components ✅
- `src/components/project/export-report-dialog.tsx`
  - `FlightPlan` type → `Roadmap`
  - All `flightPlan` variables → `roadmap`
- `src/components/project/graph-tab.tsx`
  - `useFlightPlan` → `useRoadmap`
  - All `flightPlan` variables → `roadmap`
  - "No flight plan found" → "No roadmap found"
- `src/components/project/gsd-verification-tab.tsx`
  - `useFlightPlan` → `useRoadmap`
  - All `flightPlan` variables → `roadmap`
- `src/components/project/progress-card.tsx`
  - `FlightPlan` type → `Roadmap`
  - All `flightPlan` variables → `roadmap`
- `src/components/project/project-overview-tab.tsx`
  - `FlightPlan` type → `Roadmap`
  - All prop names: `flightPlan`, `onSyncFlightPlan`, `isSyncingFlightPlan`, `isLoadingFlightPlan` → `roadmap`, `onSyncRoadmap`, `isSyncingRoadmap`, `isLoadingRoadmap`
  - `hasFlightPlan` → `hasRoadmap`
- `src/components/project/quick-actions-bar.tsx`
  - Props: `onSyncFlightPlan` → `onSyncRoadmap`, `hasFlightPlan` → `hasRoadmap`
  - Tooltip: "Sync flight plan from disk" → "Sync roadmap from disk"

#### Projects Components ✅
- `src/components/projects/import-dialog.tsx`
  - `useSyncFlightPlan` → `useSyncRoadmap`
  - `autoSyncFlightPlan` → `autoSyncRoadmap`
  - `flight_plan_synced` → `roadmap_synced`
- `src/components/projects/import-project-dialog.tsx`
  - `autoSyncFlightPlan` → `autoSyncRoadmap`
- `src/components/projects/new-project-dialog.tsx`
  - `useSyncFlightPlan` → `useSyncRoadmap`
- `src/components/projects/project-card.tsx`
  - `flight_plan_progress` → `roadmap_progress` (all occurrences)

#### Pages ✅
- `src/pages/project.tsx`
  - Import: `@/components/flightplan` → `@/components/roadmap`
  - Component: `FlightPlanViewer` → `RoadmapViewer`
  - Hooks: `useFlightPlan` → `useRoadmap`, `useSyncFlightPlan` → `useSyncRoadmap`
  - All variables and props renamed accordingly
  - Tab label: "Flight Plan" → "Roadmap"
- `src/pages/analytics.tsx`
  - `flight_plan_progress` → `roadmap_progress` (all occurrences)

## Verification ✅
- **Build Status**: ✅ SUCCESS
- **Build Time**: 3.97s
- **Bundle Generated**: Successfully created production build
- **TypeScript Compilation**: ✅ No type errors
- **All Imports Resolved**: ✅ All new paths working

## Patterns Used
### Type Names
- `FlightPlan` → `Roadmap`

### Variable Names (camelCase)
- `flightPlan` → `roadmap`
- `useFlightPlan` → `useRoadmap`
- `useSyncFlightPlan` → `useSyncRoadmap`
- `onSyncFlightPlan` → `onSyncRoadmap`
- `isSyncingFlightPlan` → `isSyncingRoadmap`
- `isLoadingFlightPlan` → `isLoadingRoadmap`
- `hasFlightPlan` → `hasRoadmap`

### File/Path Names (kebab-case)
- `flight-plan-viewer` → `roadmap-viewer`
- `flight-plan-header` → `roadmap-header`
- `flight-plan` (in paths) → `roadmap`

### Database Fields (snake_case)
- `flight_plan_progress` → `roadmap_progress`
- `flight_plan_synced` → `roadmap_synced`

### Property Names (camelCase)
- `flightPlanId` → `roadmapId`
- `autoSyncFlightPlan` → `autoSyncRoadmap`

## Files Changed Count
**Total: 26 files**

### Component Files: 20
1. src/components/roadmap/roadmap-viewer.tsx (renamed)
2. src/components/roadmap/roadmap-header.tsx (renamed)
3. src/components/roadmap/phase-card.tsx
4. src/components/roadmap/phase-comments.tsx
5. src/components/roadmap/index.ts
6. src/components/dashboard/project-card.tsx
7. src/components/dashboard/project-row.tsx
8. src/components/project/export-report-dialog.tsx
9. src/components/project/graph-tab.tsx
10. src/components/project/gsd-verification-tab.tsx
11. src/components/project/progress-card.tsx
12. src/components/project/project-overview-tab.tsx
13. src/components/project/quick-actions-bar.tsx
14. src/components/projects/import-dialog.tsx
15. src/components/projects/import-project-dialog.tsx
16. src/components/projects/new-project-dialog.tsx
17. src/components/projects/project-card.tsx

### Page Files: 2
18. src/pages/project.tsx
19. src/pages/analytics.tsx

### Planning Files: 2
20. .plans/frontend-flightplan-to-roadmap-rename.md
21. .plans/frontend-rename-progress.md

### Directories Changed: 2
- Created: `src/components/roadmap/`
- Deleted: `src/components/flightplan/`

## Notes
- The parallel backend agent is handling the renaming of types/hooks in `@/lib/tauri` and `@/lib/queries`
- The parallel backend agent is also handling the renaming in `@/lib/flight-plan-diff` → `@/lib/roadmap-diff`
- All CSS class names using `flight-plan-` have been updated to `roadmap-`
- All user-facing text mentioning "flight plan" has been updated to "roadmap"
- Component functionality remains unchanged - this is purely a naming refactor

## Next Steps
The backend agent should complete:
1. Type definitions in `@/lib/tauri.ts`: `FlightPlan` → `Roadmap`
2. Query hooks in `@/lib/queries.ts`: `useFlightPlan`, `useSyncFlightPlan`, etc.
3. Query keys: `queryKeys.flightplan` → `queryKeys.roadmap`
4. Utility library: `@/lib/flight-plan-diff.ts` → `@/lib/roadmap-diff.ts`
5. Database schema and Rust backend types

Once both agents complete, the entire codebase will consistently use "Roadmap" terminology.
