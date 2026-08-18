// Spike 001: Can VCCA (rusqlite, read-only) read gsd-pi's WAL-mode gsd.db?
// Replicates VCCA's exact read-only open flags from src-tauri/src/db/mod.rs.

use rusqlite::{Connection, OpenFlags};

fn open_readonly(path: &str) -> rusqlite::Result<Connection> {
    // EXACT flags VCCA uses for its read pool (db/mod.rs:74-77)
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY
        | OpenFlags::SQLITE_OPEN_NO_MUTEX
        | OpenFlags::SQLITE_OPEN_URI;
    Connection::open_with_flags(path, flags)
}

fn query(conn: &Connection) -> rusqlite::Result<()> {
    // 1. Milestones / slices / tasks hierarchy (maps onto VCCA's GSD-2 UI)
    let ms: i64 = conn.query_row("SELECT count(*) FROM milestones", [], |r| r.get(0))?;
    let sl: i64 = conn.query_row("SELECT count(*) FROM slices", [], |r| r.get(0))?;
    let tk: i64 = conn.query_row("SELECT count(*) FROM tasks", [], |r| r.get(0))?;
    println!("  hierarchy: {ms} milestone(s), {sl} slice(s), {tk} task(s)");

    let mut stmt = conn.prepare(
        "SELECT m.id, m.title, s.id, s.title, s.status \
         FROM milestones m JOIN slices s ON s.milestone_id = m.id ORDER BY s.sequence",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?, r.get::<_, String>(1)?,
            r.get::<_, String>(2)?, r.get::<_, String>(3)?, r.get::<_, String>(4)?,
        ))
    })?;
    for row in rows {
        let (mid, mt, sid, st, sstatus) = row?;
        println!("    {mid} {mt:?} → {sid} {st:?} [{sstatus}]");
    }

    // 2. Artifacts (planning docs stored as DB rows, full_content available)
    let mut stmt = conn.prepare(
        "SELECT artifact_type, path, length(full_content) FROM artifacts ORDER BY path",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?))
    })?;
    println!("  artifacts (docs in DB):");
    for row in rows {
        let (t, p, len) = row?;
        println!("    [{t}] {p} ({len} bytes of full_content)");
    }

    // 3. State via runtime_kv (replaces STATE.md)
    let status: String = conn.query_row(
        "SELECT value_json FROM runtime_kv WHERE scope='global' AND key='status'",
        [], |r| r.get(0),
    )?;
    let active: String = conn.query_row(
        "SELECT value_json FROM runtime_kv WHERE scope='global' AND key='active_milestone'",
        [], |r| r.get(0),
    )?;
    println!("  state(runtime_kv): status={status}, active_milestone={active}");

    // 4. Decisions + requirements
    let d: i64 = conn.query_row("SELECT count(*) FROM decisions", [], |r| r.get(0))?;
    let rq: i64 = conn.query_row("SELECT count(*) FROM requirements", [], |r| r.get(0))?;
    println!("  decisions: {d}, requirements: {rq}");
    Ok(())
}

fn main() {
    let path = std::env::args().nth(1).expect("usage: proof <db-path>");
    let mode = std::env::args().nth(2).unwrap_or_default();

    let target = if mode == "immutable" {
        // Fallback: immutable URI bypasses WAL/-shm entirely (stale-but-readable)
        format!("file:{path}?immutable=1")
    } else {
        path.clone()
    };

    println!("== open read-only: {target} ==");
    match open_readonly(&target) {
        Ok(conn) => match query(&conn) {
            Ok(()) => println!("RESULT: OK — read-only read succeeded"),
            Err(e) => {
                println!("RESULT: QUERY-FAILED — {e}");
                std::process::exit(3);
            }
        },
        Err(e) => {
            println!("RESULT: OPEN-FAILED — {e}");
            std::process::exit(2);
        }
    }
}
