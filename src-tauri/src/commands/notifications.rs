// Control Tower - Notification Commands
// Bell icon + dropdown notification center
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{CreateNotificationInput, Notification};
use rusqlite::params;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

type DbState = Arc<crate::db::DbPool>;

const MAX_NOTIFICATIONS: i32 = 100;

/// Get notifications with optional filters
#[tauri::command]
pub async fn get_notifications(
    db: tauri::State<'_, DbState>,
    limit: Option<i32>,
    unread_only: Option<bool>,
) -> Result<Vec<Notification>, String> {
    let db = db.write().await;
    let conn = db.conn();
    let limit = limit.unwrap_or(50);
    let unread_only = unread_only.unwrap_or(false);

    let sql = if unread_only {
        "SELECT id, project_id, notification_type, title, message, link, read, created_at
         FROM notifications WHERE read = 0 ORDER BY created_at DESC LIMIT ?1"
    } else {
        "SELECT id, project_id, notification_type, title, message, link, read, created_at
         FROM notifications ORDER BY created_at DESC LIMIT ?1"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let notifications = stmt
        .query_map(params![limit], |row| {
            Ok(Notification {
                id: row.get(0)?,
                project_id: row.get(1)?,
                notification_type: row.get(2)?,
                title: row.get(3)?,
                message: row.get(4)?,
                link: row.get(5)?,
                read: row.get::<_, i32>(6)? != 0,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(notifications)
}

/// Get count of unread notifications
#[tauri::command]
pub async fn get_unread_notification_count(db: tauri::State<'_, DbState>) -> Result<i32, String> {
    let db = db.write().await;
    let conn = db.conn();

    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM notifications WHERE read = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count)
}

/// Create a new notification, emit event, and auto-prune old entries
#[tauri::command]
pub async fn create_notification(
    db: tauri::State<'_, DbState>,
    app: AppHandle,
    input: CreateNotificationInput,
) -> Result<Notification, String> {
    let db = db.write().await;
    let conn = db.conn();

    let notification_id = format!("{:032x}", rand::random::<u128>());

    conn.execute(
        "INSERT INTO notifications (id, project_id, notification_type, title, message, link)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            notification_id,
            input.project_id,
            input.notification_type,
            input.title,
            input.message,
            input.link,
        ],
    )
    .map_err(|e| e.to_string())?;

    let notification = conn
        .query_row(
            "SELECT id, project_id, notification_type, title, message, link, read, created_at
             FROM notifications WHERE id = ?1",
            params![notification_id],
            |row| {
                Ok(Notification {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    notification_type: row.get(2)?,
                    title: row.get(3)?,
                    message: row.get(4)?,
                    link: row.get(5)?,
                    read: row.get::<_, i32>(6)? != 0,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    // Emit event for real-time updates
    let _ = app.emit("notification:new", &notification);

    // Auto-prune: keep only the most recent MAX_NOTIFICATIONS entries
    conn.execute(
        "DELETE FROM notifications
         WHERE id NOT IN (
             SELECT id FROM notifications
             ORDER BY created_at DESC
             LIMIT ?1
         )",
        params![MAX_NOTIFICATIONS],
    )
    .map_err(|e| e.to_string())?;

    Ok(notification)
}

/// Mark a single notification as read
#[tauri::command]
pub async fn mark_notification_read(
    db: tauri::State<'_, DbState>,
    notification_id: String,
) -> Result<Notification, String> {
    let db = db.write().await;
    let conn = db.conn();

    conn.execute(
        "UPDATE notifications SET read = 1 WHERE id = ?1",
        params![notification_id],
    )
    .map_err(|e| e.to_string())?;

    let notification = conn
        .query_row(
            "SELECT id, project_id, notification_type, title, message, link, read, created_at
             FROM notifications WHERE id = ?1",
            params![notification_id],
            |row| {
                Ok(Notification {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    notification_type: row.get(2)?,
                    title: row.get(3)?,
                    message: row.get(4)?,
                    link: row.get(5)?,
                    read: row.get::<_, i32>(6)? != 0,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(notification)
}

/// Mark all notifications as read
#[tauri::command]
pub async fn mark_all_notifications_read(db: tauri::State<'_, DbState>) -> Result<i32, String> {
    let db = db.write().await;
    let conn = db.conn();

    let count = conn
        .execute("UPDATE notifications SET read = 1 WHERE read = 0", [])
        .map_err(|e| e.to_string())?;

    Ok(count as i32)
}

/// Clear all notifications
#[tauri::command]
pub async fn clear_notifications(db: tauri::State<'_, DbState>) -> Result<i32, String> {
    let db = db.write().await;
    let conn = db.conn();

    let count = conn
        .execute("DELETE FROM notifications", [])
        .map_err(|e| e.to_string())?;

    Ok(count as i32)
}
