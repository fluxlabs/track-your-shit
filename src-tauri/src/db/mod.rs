// Track Your Shit - Database Module (SQLite connection pool, schema, migrations, PRAGMA tuning)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
//
// Architecture: Read/Write connection separation for concurrent access.
//
// SQLite in WAL mode supports concurrent readers alongside a single writer.
// Previously, a single `Arc<Mutex<Database>>` serialized ALL access (reads and
// writes), causing contention when multiple React Query polling hooks fire
// simultaneously.
//
// Now:
// - `Database` holds a single connection (used for the write path)
// - `DbPool` wraps a write `Mutex<Database>` + N read `Mutex<Connection>` connections
// - Tauri commands call `pool.read()` for SELECT queries (concurrent, no writer contention)
// - Tauri commands call `pool.write()` for INSERT/UPDATE/DELETE (serialized)
// - The read pool uses round-robin distribution via `AtomicUsize`

pub mod tracing_layer;

use rusqlite::{params, Connection, OpenFlags, Result as SqliteResult};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

/// Number of read-only connections in the pool.
/// 4 is a good default for a desktop app — enough to serve concurrent
/// React Query polling hooks without over-allocating file descriptors.
const READ_POOL_SIZE: usize = 4;

/// Core database wrapper around a single rusqlite connection.
/// Used as the write connection inside `DbPool`.
pub struct Database {
    conn: Connection,
}

/// Connection pool that separates read and write paths.
///
/// - Write connection: `Arc<Mutex<Database>>` — serialized, one writer at a time.
/// - Read connections: `Vec<Arc<Mutex<Connection>>>` — round-robin, each reader
///   grabs its own mutex so multiple reads run concurrently.
///
/// All connections share the same PRAGMAs and point to the same WAL-mode DB file.
pub struct DbPool {
    writer: Arc<Mutex<Database>>,
    readers: Vec<Arc<Mutex<Connection>>>,
    next_reader: AtomicUsize,
}

impl DbPool {
    /// Create a pool from a Tauri `AppHandle` (main app path).
    pub fn new(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let app_data_dir = app.path().app_data_dir()?;
        std::fs::create_dir_all(&app_data_dir)?;

        let db_path = app_data_dir.join("track-your-shit.db");
        tracing::info!("Database path: {:?}", db_path);

        Self::open_pool(&db_path)
    }

    /// Open the pool: one read-write connection + N read-only connections.
    fn open_pool(db_path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        // Write connection (read-write)
        let write_conn = Connection::open(db_path)?;
        Database::apply_pragmas(&write_conn)?;
        let writer_db = Database { conn: write_conn };
        writer_db.initialize_schema()?;

        // Read connections (read-only via OpenFlags)
        let mut readers = Vec::with_capacity(READ_POOL_SIZE);
        for _ in 0..READ_POOL_SIZE {
            let flags = OpenFlags::SQLITE_OPEN_READ_ONLY
                | OpenFlags::SQLITE_OPEN_NO_MUTEX
                | OpenFlags::SQLITE_OPEN_URI;
            let read_conn = Connection::open_with_flags(db_path, flags)?;
            Database::apply_read_pragmas(&read_conn)?;
            readers.push(Arc::new(Mutex::new(read_conn)));
        }

        tracing::info!(
            "Database pool initialized: 1 writer + {} readers",
            READ_POOL_SIZE
        );

        Ok(Self {
            writer: Arc::new(Mutex::new(writer_db)),
            readers,
            next_reader: AtomicUsize::new(0),
        })
    }

    /// Acquire the write connection. Serialized — only one writer at a time.
    /// Use this for INSERT, UPDATE, DELETE, and any DDL operations.
    pub async fn write(&self) -> tokio::sync::MutexGuard<'_, Database> {
        self.writer.lock().await
    }

    /// Acquire a read-only connection from the pool (round-robin).
    /// Multiple readers can proceed concurrently since each reader slot
    /// has its own mutex.
    pub async fn read(&self) -> tokio::sync::MutexGuard<'_, Connection> {
        let idx = self.next_reader.fetch_add(1, Ordering::Relaxed) % self.readers.len();
        self.readers[idx].lock().await
    }

    /// Get a clone of the inner writer Arc (for passing to event listeners
    /// that need owned access).
    pub fn writer_arc(&self) -> Arc<Mutex<Database>> {
        self.writer.clone()
    }
}

impl Database {
    /// Create database using Tauri's app data directory (single connection mode).
    /// Prefer `DbPool::new()` for the Tauri app.
    pub fn new(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let app_data_dir = app.path().app_data_dir()?;
        std::fs::create_dir_all(&app_data_dir)?;

        let db_path = app_data_dir.join("track-your-shit.db");
        tracing::info!("Database path: {:?}", db_path);

        let conn = Connection::open(&db_path)?;
        Self::apply_pragmas(&conn)?;
        let db = Self { conn };
        db.initialize_schema()?;

        Ok(db)
    }

    /// Create database standalone (for MCP server mode)
    /// Uses the same path as Tauri would use
    pub fn new_standalone() -> Result<Self, Box<dyn std::error::Error>> {
        let db_path = Self::get_default_db_path()?;
        std::fs::create_dir_all(db_path.parent().unwrap())?;

        tracing::info!("Database path (standalone): {:?}", db_path);

        let conn = Connection::open(&db_path)?;
        Self::apply_pragmas(&conn)?;
        let db = Self { conn };
        db.initialize_schema()?;

        Ok(db)
    }

    /// Apply performance PRAGMAs to a read-write connection.
    ///
    /// Called once per connection (not per-query). Settings:
    /// - WAL mode: allows concurrent readers alongside a single writer
    /// - busy_timeout: wait up to 5 s for a write lock instead of failing immediately
    /// - foreign_keys: enforce FK constraints
    /// - synchronous=NORMAL: safe with WAL, reduces fsync calls (~2× write throughput)
    /// - cache_size=-8000: use ~8 MB of page cache (negative = KiB)
    /// - mmap_size=128 MB: memory-map the DB file for faster random reads
    /// - temp_store=MEMORY: keep temp tables/indexes in RAM
    fn apply_pragmas(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
        // All PRAGMAs return result rows, so use pragma_update instead of execute_batch
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "cache_size", -8000)?;
        conn.pragma_update(None, "mmap_size", 134217728)?;
        conn.pragma_update(None, "temp_store", "MEMORY")?;
        Ok(())
    }

    /// Apply PRAGMAs to a read-only connection.
    /// Read connections skip WAL/synchronous/foreign_keys (write-path only)
    /// but still benefit from cache and mmap tuning.
    fn apply_read_pragmas(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
        conn.pragma_update(None, "busy_timeout", 5000)?;
        conn.pragma_update(None, "cache_size", -4000)?;
        conn.pragma_update(None, "mmap_size", 134217728)?;
        conn.pragma_update(None, "temp_store", "MEMORY")?;
        Ok(())
    }

    /// Get the default database path (same as Tauri uses)
    pub fn get_default_db_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        // Match Tauri's app data directory structure
        #[cfg(target_os = "macos")]
        let base_dir = dirs::data_dir()
            .ok_or("Could not determine data directory")?
            .join("net.fluxlabs.track-your-shit");

        #[cfg(target_os = "linux")]
        let base_dir = dirs::data_dir()
            .ok_or("Could not determine data directory")?
            .join("net.fluxlabs.track-your-shit");

        #[cfg(target_os = "windows")]
        let base_dir = dirs::data_dir()
            .ok_or("Could not determine data directory")?
            .join("net.fluxlabs.track-your-shit");

        Ok(base_dir.join("track-your-shit.db"))
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    fn initialize_schema(&self) -> SqliteResult<()> {
        // 1. Create tables (IF NOT EXISTS -- safe for existing DBs)
        self.conn.execute_batch(SCHEMA)?;

        // 2. Run migrations (add columns, rename tables/columns for existing DBs)
        self.run_migrations()?;

        // 3. Create indexes AFTER migrations so renamed/added columns exist
        self.conn.execute_batch(INDEXES_SCHEMA).unwrap_or_else(|e| {
            tracing::warn!("Index creation (non-fatal): {}", e);
        });

        // 4. FTS5 full-text search -- non-fatal if extension not available
        match self.conn.execute_batch(FTS5_SCHEMA) {
            Ok(_) => tracing::info!("FTS5 search indexes initialized"),
            Err(e) => tracing::warn!("FTS5 search indexes not available (search will use LIKE fallback): {}", e),
        }

        tracing::info!("Database schema initialized");
        Ok(())
    }

    fn migration_applied(&self, name: &str) -> bool {
        self.conn
            .query_row(
                "SELECT 1 FROM schema_migrations WHERE name = ?1",
                params![name],
                |_| Ok(()),
            )
            .is_ok()
    }

    fn record_migration(&self, name: &str) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT INTO schema_migrations (name) VALUES (?1)",
            params![name],
        )?;
        Ok(())
    }

    fn run_migrations(&self) -> SqliteResult<()> {
        // Check if schema_migrations table exists, create if not
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                applied_at TEXT DEFAULT (datetime('now'))
            )",
            [],
        )?;

        // Migration: Add 'goal' column to phases if it doesn't exist
        if !self.migration_applied("add_goal_to_phases") {
            let has_goal_column: bool =
                self.conn.prepare("SELECT goal FROM phases LIMIT 1").is_ok();
            if !has_goal_column {
                tracing::info!("Running migration: Adding 'goal' column to phases table");
                self.conn
                    .execute("ALTER TABLE phases ADD COLUMN goal TEXT", [])?;
            }
            self.record_migration("add_goal_to_phases")?;
        }

        // Migration: Add 'prerequisites' column to phases if it doesn't exist
        if !self.migration_applied("add_prerequisites_to_phases") {
            let has_prerequisites: bool = self
                .conn
                .prepare("SELECT prerequisites FROM phases LIMIT 1")
                .is_ok();
            if !has_prerequisites {
                tracing::info!("Running migration: Adding 'prerequisites' column to phases table");
                self.conn
                    .execute("ALTER TABLE phases ADD COLUMN prerequisites TEXT", [])?;
            }
            self.record_migration("add_prerequisites_to_phases")?;
        }

        // Migration: Add 'order_index' column to phases if it doesn't exist
        if !self.migration_applied("add_order_index_to_phases") {
            let has_phase_order: bool = self
                .conn
                .prepare("SELECT order_index FROM phases LIMIT 1")
                .is_ok();
            if !has_phase_order {
                tracing::info!("Running migration: Adding 'order_index' column to phases table");
                self.conn.execute(
                    "ALTER TABLE phases ADD COLUMN order_index INTEGER DEFAULT 0",
                    [],
                )?;
            }
            self.record_migration("add_order_index_to_phases")?;
        }

        // Migration: Add 'source_file' column to phases if it doesn't exist
        if !self.migration_applied("add_source_file_to_phases") {
            let has_phase_source: bool = self
                .conn
                .prepare("SELECT source_file FROM phases LIMIT 1")
                .is_ok();
            if !has_phase_source {
                tracing::info!("Running migration: Adding 'source_file' column to phases table");
                self.conn
                    .execute("ALTER TABLE phases ADD COLUMN source_file TEXT", [])?;
            }
            self.record_migration("add_source_file_to_phases")?;
        }

        // Migration: Add 'blocked_by' column to tasks if it doesn't exist
        if !self.migration_applied("add_blocked_by_to_tasks") {
            let has_blocked_by: bool = self
                .conn
                .prepare("SELECT blocked_by FROM tasks LIMIT 1")
                .is_ok();
            if !has_blocked_by {
                tracing::info!("Running migration: Adding 'blocked_by' column to tasks table");
                self.conn
                    .execute("ALTER TABLE tasks ADD COLUMN blocked_by TEXT", [])?;
            }
            self.record_migration("add_blocked_by_to_tasks")?;
        }

        // Migration: Add 'order_index' column to tasks if it doesn't exist
        if !self.migration_applied("add_order_index_to_tasks") {
            let has_task_order: bool = self
                .conn
                .prepare("SELECT order_index FROM tasks LIMIT 1")
                .is_ok();
            if !has_task_order {
                tracing::info!("Running migration: Adding 'order_index' column to tasks table");
                self.conn.execute(
                    "ALTER TABLE tasks ADD COLUMN order_index INTEGER DEFAULT 0",
                    [],
                )?;
            }
            self.record_migration("add_order_index_to_tasks")?;
        }

        // Migration: Add 'is_favorite' column to projects if it doesn't exist
        if !self.migration_applied("add_is_favorite_to_projects") {
            let has_is_favorite: bool = self
                .conn
                .prepare("SELECT is_favorite FROM projects LIMIT 1")
                .is_ok();
            if !has_is_favorite {
                tracing::info!("Running migration: Adding 'is_favorite' column to projects table");
                self.conn.execute(
                    "ALTER TABLE projects ADD COLUMN is_favorite INTEGER DEFAULT 0",
                    [],
                )?;
            }
            self.record_migration("add_is_favorite_to_projects")?;
        }

        // Migration: Add 'milestone' column to phases if it doesn't exist
        if !self.migration_applied("add_milestone_to_phases") {
            let has_milestone: bool = self
                .conn
                .prepare("SELECT milestone FROM phases LIMIT 1")
                .is_ok();
            if !has_milestone {
                tracing::info!("Running migration: Adding 'milestone' column to phases table");
                self.conn
                    .execute("ALTER TABLE phases ADD COLUMN milestone TEXT", [])?;
            }
            self.record_migration("add_milestone_to_phases")?;
        }

        // Migration: Add 'gsd_metadata' column to phases if it doesn't exist
        if !self.migration_applied("add_gsd_metadata_to_phases") {
            let has_gsd_metadata: bool = self
                .conn
                .prepare("SELECT gsd_metadata FROM phases LIMIT 1")
                .is_ok();
            if !has_gsd_metadata {
                tracing::info!("Running migration: Adding 'gsd_metadata' column to phases table");
                self.conn
                    .execute("ALTER TABLE phases ADD COLUMN gsd_metadata TEXT", [])?;
            }
            self.record_migration("add_gsd_metadata_to_phases")?;
        }

        // Clean up stale triggers/views from old schema that reference flight_plans.
        // Query sqlite_master for any objects whose SQL mentions 'flight_plans'.
        {
            let stale_objects: Vec<(String, String)> = self.conn
                .prepare("SELECT type, name FROM sqlite_master WHERE sql LIKE '%flight_plans%' AND type IN ('trigger', 'view')")
                .and_then(|mut stmt| {
                    stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                        .map(|rows| rows.filter_map(|r| r.ok()).collect())
                })
                .unwrap_or_default();
            for (obj_type, obj_name) in &stale_objects {
                let drop_sql = format!("DROP {} IF EXISTS \"{}\"", obj_type.to_uppercase(), obj_name);
                tracing::info!("Dropping stale {}: {}", obj_type, obj_name);
                self.conn.execute(&drop_sql, []).ok();
            }
        }

        // Migration: Rename flight_plans -> roadmaps, flight_plan_id -> roadmap_id
        if !self.migration_applied("rename_flight_plans_to_roadmaps") {
            // Check if the old table exists
            let has_old_table: bool = self
                .conn
                .prepare("SELECT 1 FROM flight_plans LIMIT 1")
                .is_ok();
            // Check if the new table already exists (created by SCHEMA)
            let has_new_table: bool = self
                .conn
                .prepare("SELECT 1 FROM roadmaps LIMIT 1")
                .is_ok();

            if has_old_table && has_new_table {
                // Both exist: SCHEMA created empty roadmaps, old flight_plans has data.
                // Move data from old table to new, then drop old.
                tracing::info!("Running migration: Migrating data from flight_plans -> roadmaps");
                self.conn.execute(
                    "INSERT OR IGNORE INTO roadmaps SELECT * FROM flight_plans",
                    [],
                ).unwrap_or_else(|e| {
                    tracing::warn!("Data migration flight_plans->roadmaps: {}", e);
                    0
                });
                self.conn.execute("DROP TABLE IF EXISTS flight_plans", [])?;
            } else if has_old_table && !has_new_table {
                // Only old table: simple rename
                tracing::info!("Running migration: Renaming flight_plans -> roadmaps");
                self.conn
                    .execute("ALTER TABLE flight_plans RENAME TO roadmaps", [])?;
            }

            // Rename column in phases if it still has the old name
            let has_old_column: bool = self
                .conn
                .prepare("SELECT flight_plan_id FROM phases LIMIT 1")
                .is_ok();
            if has_old_column {
                self.conn
                    .execute(
                        "ALTER TABLE phases RENAME COLUMN flight_plan_id TO roadmap_id",
                        [],
                    )?;
            }

            // Drop old indexes
            self.conn
                .execute("DROP INDEX IF EXISTS idx_phases_flight_plan", [])?;
            self.conn
                .execute("DROP INDEX IF EXISTS idx_flight_plans_project", [])?;

            self.record_migration("rename_flight_plans_to_roadmaps")?;
        }

        // Migration: Fix phases FK to reference roadmaps instead of flight_plans
        // ALTER TABLE RENAME COLUMN doesn't update FK references in SQLite
        if !self.migration_applied("fix_phases_fk_roadmaps") {
            // Check if phases table FK still references flight_plans
            let phases_sql: Option<String> = self.conn
                .query_row(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name='phases'",
                    [],
                    |row| row.get(0),
                )
                .ok();
            
            if let Some(sql) = &phases_sql {
                if sql.contains("flight_plans") {
                    tracing::info!("Running migration: Fixing phases FK to reference roadmaps");
                    // Disable FK checks during migration
                    self.conn.pragma_update(None, "foreign_keys", "OFF")?;
                    self.conn.execute_batch(
                        "BEGIN TRANSACTION;
                         CREATE TABLE phases_new (
                             id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                             roadmap_id TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
                             phase_number INTEGER NOT NULL,
                             name TEXT NOT NULL,
                             description TEXT,
                             status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
                             group_number INTEGER,
                             total_tasks INTEGER DEFAULT 0,
                             completed_tasks INTEGER DEFAULT 0,
                             estimated_cost REAL,
                             actual_cost REAL,
                             prerequisites TEXT,
                             order_index INTEGER DEFAULT 0,
                             source_file TEXT,
                             started_at TEXT,
                             completed_at TEXT,
                             created_at TEXT DEFAULT (datetime('now')),
                             updated_at TEXT DEFAULT (datetime('now')),
                             goal TEXT,
                             estimated_minutes INTEGER,
                             actual_minutes INTEGER,
                             milestone TEXT,
                             gsd_metadata TEXT
                         );
                         INSERT INTO phases_new SELECT * FROM phases;
                         DROP TABLE phases;
                         ALTER TABLE phases_new RENAME TO phases;
                         COMMIT;"
                    )?;
                    self.conn.pragma_update(None, "foreign_keys", "ON")?;
                    tracing::info!("Phases FK migration complete");
                }
            }
            self.record_migration("fix_phases_fk_roadmaps")?;
        }

        // Migration: Drop stale AutoPilot tables that are no longer in the schema
        if !self.migration_applied("drop_stale_ap_tables") {
            tracing::info!("Running migration: Dropping stale AutoPilot tables");
            self.conn.execute_batch(
                "DROP TABLE IF EXISTS executions;
                 DROP TABLE IF EXISTS checkpoints;
                 DROP TABLE IF EXISTS cache_statistics;
                 DROP TABLE IF EXISTS execution_bookmarks;
                 DROP TABLE IF EXISTS webhooks;"
            ).unwrap_or_else(|e| {
                tracing::warn!("Drop stale AP tables (non-fatal): {}", e);
            });
            self.record_migration("drop_stale_ap_tables")?;
        }

        // Migration: Remove stale FK references to dropped executions table
        // costs, decisions, activity_log, test_runs all had: execution_id REFERENCES executions(id)
        if !self.migration_applied("remove_executions_fk") {
            let tables_with_stale_fk: Vec<String> = self.conn
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%REFERENCES executions%'")
                .and_then(|mut stmt| {
                    stmt.query_map([], |row| row.get::<_, String>(0))
                        .map(|rows| rows.filter_map(|r| r.ok()).collect())
                })
                .unwrap_or_default();

            if !tables_with_stale_fk.is_empty() {
                tracing::info!("Running migration: Removing stale executions FK from {} tables", tables_with_stale_fk.len());
                self.conn.pragma_update(None, "foreign_keys", "OFF")?;

                for table_name in &tables_with_stale_fk {
                    // Get the original CREATE TABLE SQL
                    let original_sql: Option<String> = self.conn
                        .query_row(
                            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?1",
                            params![table_name],
                            |row| row.get(0),
                        )
                        .ok();

                    if let Some(sql) = original_sql {
                        // Remove the REFERENCES executions(id) ON DELETE SET NULL clause
                        let new_sql = sql
                            .replace(" REFERENCES executions(id) ON DELETE SET NULL", "")
                            .replace(" REFERENCES executions(id) ON DELETE CASCADE", "")
                            .replace(" REFERENCES executions(id)", "");

                        // Rename to temp name using the cleaned SQL
                        let temp_name = format!("{}_new", table_name);
                        let create_new = new_sql.replacen(
                            &format!("CREATE TABLE {}", table_name),
                            &format!("CREATE TABLE {}", temp_name),
                            1,
                        ).replacen(
                            &format!("CREATE TABLE \"{}\"", table_name),
                            &format!("CREATE TABLE \"{}\"", temp_name),
                            1,
                        );

                        let migrate_sql = format!(
                            "{};\nINSERT INTO \"{}\" SELECT * FROM \"{}\";\nDROP TABLE \"{}\";\nALTER TABLE \"{}\" RENAME TO \"{}\";",
                            create_new, temp_name, table_name, table_name, temp_name, table_name
                        );

                        if let Err(e) = self.conn.execute_batch(&migrate_sql) {
                            tracing::warn!("Failed to remove executions FK from {}: {}", table_name, e);
                        } else {
                            tracing::info!("Removed executions FK from {}", table_name);
                        }
                    }
                }

                self.conn.pragma_update(None, "foreign_keys", "ON")?;
            }
            self.record_migration("remove_executions_fk")?;
        }

        // Migration: Rename 'wave' column to 'group_number' in phases and gsd_plans
        if !self.migration_applied("rename_wave_to_group_number") {
            let has_wave_phases: bool = self.conn
                .prepare("SELECT wave FROM phases LIMIT 1")
                .is_ok();
            if has_wave_phases {
                tracing::info!("Running migration: Renaming wave -> group_number in phases");
                self.conn.execute(
                    "ALTER TABLE phases RENAME COLUMN wave TO group_number", []
                )?;
            }
            let has_wave_gsd: bool = self.conn
                .prepare("SELECT wave FROM gsd_plans LIMIT 1")
                .is_ok();
            if has_wave_gsd {
                tracing::info!("Running migration: Renaming wave -> group_number in gsd_plans");
                self.conn.execute(
                    "ALTER TABLE gsd_plans RENAME COLUMN wave TO group_number", []
                )?;
            }
            self.record_migration("rename_wave_to_group_number")?;
        }

        // Migration: Populate FTS5 indexes with existing data
        if !self.migration_applied("populate_fts5_indexes") {
            tracing::info!("Running migration: Populating FTS5 indexes with existing data");

            // Rebuild projects_fts from existing projects data
            self.conn
                .execute_batch(
                    "INSERT INTO projects_fts(rowid, name, description)
                 SELECT rowid, name, COALESCE(description, '') FROM projects;",
                )
                .unwrap_or_else(|e| {
                    tracing::warn!("FTS5 projects populate (may already be populated): {}", e);
                });

            // Rebuild knowledge_fts from existing knowledge data
            self.conn
                .execute_batch(
                    "INSERT INTO knowledge_fts(rowid, title, content)
                 SELECT rowid, title, content FROM knowledge;",
                )
                .unwrap_or_else(|e| {
                    tracing::warn!("FTS5 knowledge populate (may already be populated): {}", e);
                });

            // Rebuild decisions_fts from existing decisions data
            self.conn
                .execute_batch(
                    "INSERT INTO decisions_fts(rowid, question, answer)
                 SELECT rowid, question, answer FROM decisions;",
                )
                .unwrap_or_else(|e| {
                    tracing::warn!("FTS5 decisions populate (may already be populated): {}", e);
                });

            self.record_migration("populate_fts5_indexes")?;
        }

        // Migration: Rebuild all GSD tables to match actual insert column lists
        if !self.migration_applied("gsd_tables_full_rebuild") {
            tracing::info!("Rebuilding GSD tables to match correct schema");
            // Drop all GSD tables so SCHEMA creates them fresh with correct columns.
            // Data loss is acceptable — tables are fully rebuilt from .planning/ files on next sync.
            for table in &[
                "gsd_plans", "gsd_summaries", "gsd_phase_research",
                "gsd_verifications", "gsd_milestones", "gsd_requirements",
                "gsd_todos", "gsd_config", "gsd_debug_sessions",
            ] {
                self.conn.execute(&format!("DROP TABLE IF EXISTS {}", table), []).ok();
            }
            // Re-run schema to recreate with correct columns
            self.conn.execute_batch(SCHEMA).ok();
            self.record_migration("gsd_tables_full_rebuild")?;
        }

        // Migration: Rebuild gsd_requirements without title NOT NULL constraint
        if !self.migration_applied("gsd_requirements_drop_title_notnull") {
            // Check if title column exists with NOT NULL (causes insert failures)
            let has_title: bool = self.conn.prepare("SELECT title FROM gsd_requirements LIMIT 1").is_ok();
            if has_title {
                tracing::info!("Rebuilding gsd_requirements to remove title NOT NULL constraint");
                self.conn.execute_batch("
                    CREATE TABLE IF NOT EXISTS gsd_requirements_new (
                        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        req_id TEXT NOT NULL,
                        description TEXT,
                        category TEXT,
                        priority TEXT DEFAULT 'normal',
                        scope TEXT DEFAULT 'v1',
                        phase TEXT,
                        status TEXT DEFAULT 'pending',
                        created_at TEXT DEFAULT (datetime('now'))
                    );
                    INSERT INTO gsd_requirements_new (id, project_id, req_id, description, category, priority, phase, status, created_at)
                        SELECT id, project_id, req_id, description, category, priority, phase, status, created_at FROM gsd_requirements;
                    DROP TABLE gsd_requirements;
                    ALTER TABLE gsd_requirements_new RENAME TO gsd_requirements;
                ").ok();
            }
            self.record_migration("gsd_requirements_drop_title_notnull")?;
        }

        // Migration: Add missing columns to GSD tables (schema may have created them without all columns)
        if !self.migration_applied("gsd_table_column_fixes") {
            // gsd_requirements: add category and priority if missing
            if self.conn.prepare("SELECT category FROM gsd_requirements LIMIT 1").is_err() {
                self.conn.execute("ALTER TABLE gsd_requirements ADD COLUMN category TEXT", []).ok();
            }
            if self.conn.prepare("SELECT priority FROM gsd_requirements LIMIT 1").is_err() {
                self.conn.execute("ALTER TABLE gsd_requirements ADD COLUMN priority TEXT DEFAULT 'normal'", []).ok();
            }
            // gsd_todos: add all extended columns if missing
            for col in &[
                ("area", "TEXT"),
                ("phase", "TEXT"),
                ("priority", "TEXT DEFAULT 'normal'"),
                ("files", "TEXT"),
                ("source_file", "TEXT"),
                ("completed_at", "TEXT"),
            ] {
                if self.conn.prepare(&format!("SELECT {} FROM gsd_todos LIMIT 1", col.0)).is_err() {
                    self.conn.execute(
                        &format!("ALTER TABLE gsd_todos ADD COLUMN {} {}", col.0, col.1), []
                    ).ok();
                }
            }
            // gsd_milestones: add phase_start, phase_end if missing
            for col in &[("phase_start", "TEXT"), ("phase_end", "TEXT"), ("version", "TEXT")] {
                if self.conn.prepare(&format!("SELECT {} FROM gsd_milestones LIMIT 1", col.0)).is_err() {
                    self.conn.execute(
                        &format!("ALTER TABLE gsd_milestones ADD COLUMN {} {}", col.0, col.1), []
                    ).ok();
                }
            }
            // gsd_verifications: add extended columns if missing
            for col in &[
                ("phase_number", "INTEGER"),
                ("checks_total", "INTEGER DEFAULT 0"),
                ("checks_passed", "INTEGER DEFAULT 0"),
                ("result", "TEXT"),
                ("raw_content", "TEXT"),
                ("source_file", "TEXT"),
            ] {
                if self.conn.prepare(&format!("SELECT {} FROM gsd_verifications LIMIT 1", col.0)).is_err() {
                    self.conn.execute(
                        &format!("ALTER TABLE gsd_verifications ADD COLUMN {} {}", col.0, col.1), []
                    ).ok();
                }
            }
            self.record_migration("gsd_table_column_fixes")?;
        }

        tracing::info!("Database migrations complete");
        Ok(())
    }
}

const SCHEMA: &str = r#"
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    description TEXT,
    tech_stack TEXT,
    config TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Costs table
CREATE TABLE IF NOT EXISTS costs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    execution_id TEXT,
    phase TEXT,
    task TEXT,
    agent TEXT,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Roadmaps table (formerly flight_plans)
CREATE TABLE IF NOT EXISTS roadmaps (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    total_phases INTEGER DEFAULT 0,
    completed_phases INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    estimated_cost REAL,
    actual_cost REAL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    source_file TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Phases table
CREATE TABLE IF NOT EXISTS phases (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    roadmap_id TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
    phase_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    goal TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'skipped')),
    group_number INTEGER,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    estimated_cost REAL,
    actual_cost REAL,
    prerequisites TEXT,
    order_index INTEGER DEFAULT 0,
    source_file TEXT,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Phase comments table
CREATE TABLE IF NOT EXISTS phase_comments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    phase_id TEXT NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    phase_id TEXT NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
    task_number TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'failed', 'skipped')),
    agent TEXT,
    model TEXT,
    estimated_cost REAL,
    actual_cost REAL,
    files_created TEXT,
    files_modified TEXT,
    blocked_by TEXT,
    order_index INTEGER DEFAULT 0,
    commit_hash TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Decisions table
CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    execution_id TEXT,
    phase TEXT,
    category TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    reasoning TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    execution_id TEXT,
    event_type TEXT NOT NULL,
    message TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Cost thresholds table (per-project overrides)
CREATE TABLE IF NOT EXISTS cost_thresholds (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    warn_cost REAL DEFAULT 10.0,
    alert_cost REAL DEFAULT 25.0,
    stop_cost REAL DEFAULT 50.0,
    enabled INTEGER DEFAULT 1,
    alert_acknowledged INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Knowledge table for persistent memory
CREATE TABLE IF NOT EXISTS knowledge (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'learning' CHECK (category IN ('learning', 'decision', 'reference', 'fact')),
    source TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Test runs table
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    execution_id TEXT,
    phase TEXT,
    total_tests INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    coverage_lines REAL,
    coverage_branches REAL,
    coverage_functions REAL,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Test results table
CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_file TEXT,
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped')),
    duration_ms INTEGER DEFAULT 0,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Flaky tests table
CREATE TABLE IF NOT EXISTS flaky_tests (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_file TEXT,
    total_runs INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    flake_rate REAL DEFAULT 0,
    last_failure TEXT,
    first_seen TEXT DEFAULT (datetime('now')),
    UNIQUE(project_id, test_name, test_file)
);

-- App logs table for unified application logging
CREATE TABLE IF NOT EXISTS app_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    level TEXT NOT NULL CHECK (level IN ('trace','debug','info','warn','error')),
    target TEXT,
    message TEXT NOT NULL,
    source TEXT DEFAULT 'backend',
    project_id TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Command history table
CREATE TABLE IF NOT EXISTS command_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Snippets table
CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    command TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Script favorites table
CREATE TABLE IF NOT EXISTS script_favorites (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    script_id TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(project_id, script_id)
);

-- Auto commands table
CREATE TABLE IF NOT EXISTS auto_commands (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    command TEXT NOT NULL,
    hook_type TEXT NOT NULL DEFAULT 'pre' CHECK (hook_type IN ('pre', 'post')),
    enabled INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    preset TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT DEFAULT (datetime('now'))
);

-- GSD: Todos (matches gsd.rs insert: id, project_id, title, description, area, phase, priority, status, is_blocker, files, source_file, created_at, completed_at)
CREATE TABLE IF NOT EXISTS gsd_todos (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    area TEXT,
    phase TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending',
    is_blocker INTEGER NOT NULL DEFAULT 0,
    files TEXT,
    source_file TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

-- GSD: Debug sessions (managed via gsd.rs CRUD commands)
CREATE TABLE IF NOT EXISTS gsd_debug_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    error_message TEXT,
    root_cause TEXT,
    solution TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- GSD: Requirements (matches insert: project_id, req_id, description, category, priority, status, phase)
CREATE TABLE IF NOT EXISTS gsd_requirements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    req_id TEXT NOT NULL,
    description TEXT,
    category TEXT,
    priority TEXT DEFAULT 'normal',
    scope TEXT DEFAULT 'v1',
    phase TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);

-- GSD: Milestones (matches insert: project_id, name, version, phase_start, phase_end, status, completed_at)
CREATE TABLE IF NOT EXISTS gsd_milestones (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version TEXT,
    phase_start TEXT,
    phase_end TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- GSD: Verifications (matches insert: project_id, phase_number, checks_total, checks_passed, result, raw_content, source_file)
CREATE TABLE IF NOT EXISTS gsd_verifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_number INTEGER,
    checks_total INTEGER DEFAULT 0,
    checks_passed INTEGER DEFAULT 0,
    result TEXT,
    raw_content TEXT,
    source_file TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- GSD: Config cache (matches insert: project_id, workflow_mode, model_profile, raw_json, synced_at)
CREATE TABLE IF NOT EXISTS gsd_config (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    workflow_mode TEXT,
    model_profile TEXT,
    raw_json TEXT,
    synced_at TEXT DEFAULT (datetime('now'))
);

-- GSD: Plans (matches insert: project_id, phase_number, plan_number, plan_type, group_number, autonomous, objective, task_count, source_file)
CREATE TABLE IF NOT EXISTS gsd_plans (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_number TEXT,
    plan_number INTEGER NOT NULL DEFAULT 1,
    plan_type TEXT,
    group_number INTEGER NOT NULL DEFAULT 1,
    autonomous INTEGER DEFAULT 0,
    objective TEXT,
    task_count INTEGER DEFAULT 0,
    source_file TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- GSD: Summaries (matches insert: project_id, phase_number, plan_number, subsystem, duration, completed, accomplishments, files_created, files_modified, self_check, source_file)
CREATE TABLE IF NOT EXISTS gsd_summaries (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_number TEXT,
    plan_number INTEGER DEFAULT 1,
    subsystem TEXT,
    duration TEXT,
    completed INTEGER DEFAULT 0,
    accomplishments TEXT,
    files_created TEXT,
    files_modified TEXT,
    self_check TEXT,
    source_file TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- GSD: Phase research (matches insert: project_id, phase_number, domain, confidence, summary, raw_content, source_file)
CREATE TABLE IF NOT EXISTS gsd_phase_research (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_number TEXT,
    domain TEXT,
    confidence TEXT,
    summary TEXT,
    raw_content TEXT,
    source_file TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- GSD: Validation plans (matches VALIDATION.md per phase)
CREATE TABLE IF NOT EXISTS gsd_validations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_number TEXT NOT NULL,
    test_framework TEXT,
    quick_run_cmd TEXT,
    full_run_cmd TEXT,
    nyquist_rate TEXT,
    task_map_json TEXT,
    manual_checks_json TEXT,
    wave_tracking_json TEXT,
    raw_content TEXT,
    source_file TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- GSD: UAT results (matches XX-UAT.md per phase, generated by /gsd:verify-work)
CREATE TABLE IF NOT EXISTS gsd_uat_results (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_number TEXT NOT NULL,
    session_number INTEGER DEFAULT 1,
    status TEXT DEFAULT 'testing',
    tests_json TEXT,
    issues_json TEXT,
    gaps_json TEXT,
    diagnosis TEXT,
    raw_content TEXT,
    source_file TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

"#;

// Indexes are applied AFTER migrations so that renamed/added columns exist.
const INDEXES_SCHEMA: &str = r#"
CREATE INDEX IF NOT EXISTS idx_costs_project ON costs(project_id);
CREATE INDEX IF NOT EXISTS idx_costs_execution ON costs(execution_id);
CREATE INDEX IF NOT EXISTS idx_costs_created ON costs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_execution ON activity_log(execution_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_phases_roadmap ON phases(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_phase_comments_phase ON phase_comments(phase_id);
CREATE INDEX IF NOT EXISTS idx_tasks_phase ON tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_project ON roadmaps(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_thresholds_project ON cost_thresholds(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_execution ON test_runs(execution_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_created ON test_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_test_results_run ON test_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);
CREATE INDEX IF NOT EXISTS idx_flaky_tests_project ON flaky_tests(project_id);
CREATE INDEX IF NOT EXISTS idx_flaky_tests_rate ON flaky_tests(flake_rate);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_source ON app_logs(source);
CREATE INDEX IF NOT EXISTS idx_app_logs_project ON app_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_created ON app_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_app_logs_target ON app_logs(target);
CREATE INDEX IF NOT EXISTS idx_command_history_project ON command_history(project_id);
CREATE INDEX IF NOT EXISTS idx_command_history_created ON command_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snippets_project ON snippets(project_id);
CREATE INDEX IF NOT EXISTS idx_snippets_category ON snippets(category);
CREATE INDEX IF NOT EXISTS idx_script_favorites_project ON script_favorites(project_id);
CREATE INDEX IF NOT EXISTS idx_auto_commands_project ON auto_commands(project_id);
CREATE INDEX IF NOT EXISTS idx_auto_commands_hook ON auto_commands(hook_type);
-- Composite indexes for common multi-column query patterns
CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_project_category ON decisions(project_id, category);
"#;

const FTS5_SCHEMA: &str = r#"
-- FTS5 virtual tables for full-text search
-- Drop stale triggers first to avoid conflicts on schema rebuild
DROP TRIGGER IF EXISTS projects_fts_insert;
DROP TRIGGER IF EXISTS projects_fts_update;
DROP TRIGGER IF EXISTS projects_fts_delete;
DROP TRIGGER IF EXISTS knowledge_fts_insert;
DROP TRIGGER IF EXISTS knowledge_fts_update;
DROP TRIGGER IF EXISTS knowledge_fts_delete;
DROP TRIGGER IF EXISTS decisions_fts_insert;
DROP TRIGGER IF EXISTS decisions_fts_update;
DROP TRIGGER IF EXISTS decisions_fts_delete;

CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
    name, description, content=projects, content_rowid=rowid
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
    title, content, content=knowledge, content_rowid=rowid
);

CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
    question, answer, content=decisions, content_rowid=rowid
);

-- Triggers to keep projects_fts in sync
CREATE TRIGGER IF NOT EXISTS projects_fts_insert AFTER INSERT ON projects BEGIN
    INSERT INTO projects_fts(rowid, name, description)
    VALUES (new.rowid, new.name, COALESCE(new.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS projects_fts_update AFTER UPDATE ON projects BEGIN
    INSERT INTO projects_fts(projects_fts, rowid, name, description)
    VALUES ('delete', old.rowid, old.name, COALESCE(old.description, ''));
    INSERT INTO projects_fts(rowid, name, description)
    VALUES (new.rowid, new.name, COALESCE(new.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS projects_fts_delete AFTER DELETE ON projects BEGIN
    INSERT INTO projects_fts(projects_fts, rowid, name, description)
    VALUES ('delete', old.rowid, old.name, COALESCE(old.description, ''));
END;

-- Triggers to keep knowledge_fts in sync
CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert AFTER INSERT ON knowledge BEGIN
    INSERT INTO knowledge_fts(rowid, title, content)
    VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_fts_update AFTER UPDATE ON knowledge BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content)
    VALUES ('delete', old.rowid, old.title, old.content);
    INSERT INTO knowledge_fts(rowid, title, content)
    VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_fts_delete AFTER DELETE ON knowledge BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content)
    VALUES ('delete', old.rowid, old.title, old.content);
END;

-- Triggers to keep decisions_fts in sync
CREATE TRIGGER IF NOT EXISTS decisions_fts_insert AFTER INSERT ON decisions BEGIN
    INSERT INTO decisions_fts(rowid, question, answer)
    VALUES (new.rowid, new.question, new.answer);
END;

CREATE TRIGGER IF NOT EXISTS decisions_fts_update AFTER UPDATE ON decisions BEGIN
    INSERT INTO decisions_fts(decisions_fts, rowid, question, answer)
    VALUES ('delete', old.rowid, old.question, old.answer);
    INSERT INTO decisions_fts(rowid, question, answer)
    VALUES (new.rowid, new.question, new.answer);
END;

CREATE TRIGGER IF NOT EXISTS decisions_fts_delete AFTER DELETE ON decisions BEGIN
    INSERT INTO decisions_fts(decisions_fts, rowid, question, answer)
    VALUES ('delete', old.rowid, old.question, old.answer);
END;
"#;
