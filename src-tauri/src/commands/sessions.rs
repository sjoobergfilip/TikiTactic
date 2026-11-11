use tauri::AppHandle;

use crate::error::SessionError;
use crate::models::{SessionSummary, TacticsSession};
use crate::paths::sessions_dir;
use crate::repository;

#[tauri::command]
pub fn list_sessions(app: AppHandle) -> Result<Vec<SessionSummary>, SessionError> {
    repository::list(&sessions_dir(&app)?)
}

#[tauri::command]
pub fn load_session(app: AppHandle, id: String) -> Result<TacticsSession, SessionError> {
    repository::load(&sessions_dir(&app)?, &id)
}

#[tauri::command]
pub fn save_session(
    app: AppHandle,
    document: TacticsSession,
) -> Result<SessionSummary, SessionError> {
    repository::save(&sessions_dir(&app)?, &document)
}

#[tauri::command]
pub fn duplicate_session(
    app: AppHandle,
    id: String,
    title: String,
) -> Result<SessionSummary, SessionError> {
    repository::duplicate(&sessions_dir(&app)?, &id, title)
}

#[tauri::command]
pub fn delete_session(app: AppHandle, id: String) -> Result<(), SessionError> {
    repository::remove(&sessions_dir(&app)?, &id)
}
