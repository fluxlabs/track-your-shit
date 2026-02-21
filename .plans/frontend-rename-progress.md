# Frontend FlightPlan to Roadmap Rename - Progress

## Completed:
✅ src/components/roadmap/ directory created
✅ src/components/roadmap/roadmap-viewer.tsx - renamed and updated
✅ src/components/roadmap/roadmap-header.tsx - renamed and updated
✅ src/components/roadmap/phase-card.tsx - updated roadmapId prop
✅ src/components/roadmap/phase-comments.tsx - updated roadmapId prop
✅ src/components/roadmap/index.ts - updated exports
✅ src/components/flightplan/ directory deleted
✅ src/pages/project.tsx - partially updated (imports and main usages)

## In Progress - Files with Errors:
1. src/components/dashboard/project-card.tsx - flight_plan_progress → roadmap_progress
2. src/components/dashboard/project-row.tsx - flight_plan_progress → roadmap_progress
3. src/components/project/export-report-dialog.tsx - FlightPlan type
4. src/components/project/graph-tab.tsx - useFlightPlan hook
5. src/components/project/gsd-verification-tab.tsx - useFlightPlan hook
6. src/components/project/progress-card.tsx - FlightPlan type
7. src/components/project/project-overview-tab.tsx - FlightPlan type + props
8. src/components/projects/import-dialog.tsx - useSyncFlightPlan, autoSyncFlightPlan, flight_plan_synced
9. src/components/projects/import-project-dialog.tsx - autoSyncFlightPlan
10. src/components/projects/new-project-dialog.tsx - useSyncFlightPlan
11. src/components/projects/project-card.tsx - flight_plan_progress
12. src/pages/analytics.tsx - flight_plan_progress

