# VCCA — Vibe Coders Companion App

## What This Is

VCCA is a native desktop application for managing Claude Code projects. It provides project
management, terminal sessions with tmux support, knowledge base browsing, GSD workflow
integration, git operations, and AI tool management. Built with Tauri 2.x (Rust backend +
React frontend) targeting macOS and Linux.

## Core Value

A single desktop app that gives vibe coders full visibility into all their Claude Code
projects — plans, state, tasks, and terminals — without switching between terminals and
browser tabs.

## Context

VCCA runs on the developer's local machine and reads .planning/ files written by gsd-core
(the GSD workflow CLI). The backend is Rust (Tauri), the frontend is React 18 + TypeScript.
File parsing happens in gsd.rs using rusqlite for state and a custom frontmatter parser.
The app communicates over Tauri IPC — the frontend calls invoke() and the Rust backend
responds with typed structs.

## Constraints

- VCCA reads .planning/ files; it does not write them (gsd-core CLI writes them)
- GSD-2 LLM orchestration itself — VCCA monitors/controls; it does not replace the gsd CLI
- Migration tooling (.gsd/ to .planning/) — not a VCCA responsibility
- Multi-workstream browsing UI — deferred to v2.0
- Not surfaced in VCCA: internal gsd-core session keys or lock files

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Tauri 2.x over Electron | Native performance, Rust backend, smaller bundle |
| rusqlite over Diesel | Simpler, no ORM overhead, WAL mode for concurrency |
| gsd_common.rs shared module | Single-source parser; gsd2.rs frozen for Phase 13 |
| Lenient frontmatter parse | Forward compat with gsd-core@next schema additions |
