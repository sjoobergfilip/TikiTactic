use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::error::SessionError;

pub fn sessions_dir(app: &AppHandle) -> Result<PathBuf, SessionError> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("TikiTactic").join("sessions"))
        .map_err(|_| SessionError::storage())
}

pub fn session_path(root: &Path, id: &str) -> Result<PathBuf, SessionError> {
    validate_id(id)?;
    Ok(root.join(format!("{id}.tikitactic.json")))
}

pub fn validate_id(id: &str) -> Result<(), SessionError> {
    let valid = !id.is_empty()
        && id.len() <= 128
        && id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        });
    if valid {
        Ok(())
    } else {
        Err(SessionError::invalid_document())
    }
}
