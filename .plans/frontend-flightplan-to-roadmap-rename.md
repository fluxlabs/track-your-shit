# Frontend FlightPlan to Roadmap Rename Plan
// Control Tower - Rename Plan
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

## Objective
Rename all "FlightPlan" / "flight_plan" / "flightplan" references to "Roadmap" / "roadmap" in frontend components and pages.

## Phase 1: Component Directory Restructure
1. Create `src/components/roadmap/` directory
2. Move and rename files from `src/components/flightplan/`:
   - `flight-plan-viewer.tsx` → `roadmap-viewer.tsx`
   - `flight-plan-header.tsx` → `roadmap-header.tsx`
   - Move as-is: All other component files
3. Update all moved files with renamed references
4. Update `index.ts` barrel exports
5. Delete old directory

## Phase 2: Update Internal Component References
Update within moved files:
- All `FlightPlan` → `Roadmap`
- All `flightPlan` → `roadmap`
- All `flight-plan` → `roadmap` (CSS classes)
- All `flight_plan` → `roadmap`
- Import paths: `@/components/flightplan/` → `@/components/roadmap/`
- Import paths: `@/lib/flight-plan-diff` → `@/lib/roadmap-diff`

## Phase 3: Update Component Consumers
Files importing from `@/components/flightplan`:
- src/components/dashboard/project-card.tsx
- src/components/dashboard/project-row.tsx
- src/components/project/progress-card.tsx
- src/components/project/project-overview-tab.tsx
- src/components/project/graph-tab.tsx
- src/components/project/gsd-verification-tab.tsx
- src/components/project/quality-tab.tsx
- src/components/project/quick-actions-bar.tsx
- src/components/project/export-report-dialog.tsx
- src/components/projects/import-dialog.tsx
- src/components/projects/import-project-dialog.tsx
- src/components/projects/new-project-dialog.tsx
- src/components/projects/project-card.tsx
- src/components/settings/clear-data-dialog.tsx
- src/components/settings/export-data-dialog.tsx
- src/components/knowledge/knowledge-gaps.ts

## Phase 4: Update Pages
- src/pages/project.tsx
- src/pages/analytics.tsx

## Phase 5: Build Verification
Run `pnpm build` to verify all changes compile successfully.

## Replacement Patterns
- `FlightPlan` → `Roadmap` (type names, component names)
- `flightPlan` → `roadmap` (variables)
- `flight-plan` → `roadmap` (CSS classes, file names)
- `flight_plan` → `roadmap` (database fields, API keys)
- `useFlightPlan` → `useRoadmap`
- `useSyncFlightPlan` → `useSyncRoadmap`
- `queryKeys.flightplan` → `queryKeys.roadmap`
- `queryKeys.allFlightplans` → `queryKeys.allRoadmaps`
