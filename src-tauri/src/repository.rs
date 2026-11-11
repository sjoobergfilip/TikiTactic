use std::fs::{self, Metadata};
use std::path::Path;
use std::time::UNIX_EPOCH;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::error::SessionError;
use crate::models::{SessionSummary, TacticsSession};
use crate::paths::{session_path, validate_id};

const FILE_SUFFIX: &str = ".tikitactic.json";

pub fn list(root: &Path) -> Result<Vec<SessionSummary>, SessionError> {
    if !root.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(root).map_err(|_| SessionError::storage())?;
    let mut summaries = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|_| SessionError::storage())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(filename) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Some(id) = filename.strip_suffix(FILE_SUFFIX) else {
            continue;
        };
        let document = load(root, id)?;
        let metadata = entry.metadata().map_err(|_| SessionError::storage())?;
        summaries.push(summary(&document, metadata));
    }
    summaries.sort_by_key(|summary| std::cmp::Reverse(summary.modified_ms));
    Ok(summaries)
}

pub fn load(root: &Path, id: &str) -> Result<TacticsSession, SessionError> {
    let path = session_path(root, id)?;
    let bytes = fs::read(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            SessionError::not_found()
        } else {
            SessionError::storage()
        }
    })?;
    let document = serde_json::from_slice::<TacticsSession>(&bytes)
        .map_err(|_| SessionError::invalid_document())?;
    validate_document(&document)?;
    if document.id != id {
        return Err(SessionError::invalid_document());
    }
    Ok(document)
}

pub fn save(root: &Path, document: &TacticsSession) -> Result<SessionSummary, SessionError> {
    validate_document(document)?;
    fs::create_dir_all(root).map_err(|_| SessionError::storage())?;
    let path = session_path(root, &document.id)?;
    let bytes =
        serde_json::to_vec_pretty(document).map_err(|_| SessionError::invalid_document())?;
    fs::write(&path, bytes).map_err(|_| SessionError::storage())?;
    let metadata = fs::metadata(path).map_err(|_| SessionError::storage())?;
    Ok(summary(document, metadata))
}

pub fn duplicate(root: &Path, id: &str, title: String) -> Result<SessionSummary, SessionError> {
    let mut copy = load(root, id)?;
    copy.id = Uuid::new_v4().to_string();
    copy.title = title;
    copy.updated_at = OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|_| SessionError::storage())?;
    save(root, &copy)
}

pub fn remove(root: &Path, id: &str) -> Result<(), SessionError> {
    let path = session_path(root, id)?;
    fs::remove_file(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            SessionError::not_found()
        } else {
            SessionError::storage()
        }
    })
}

fn validate_document(document: &TacticsSession) -> Result<(), SessionError> {
    validate_id(&document.id)?;
    if document.version != 1 || document.slides.is_empty() {
        return Err(SessionError::invalid_document());
    }
    Ok(())
}

fn summary(document: &TacticsSession, metadata: Metadata) -> SessionSummary {
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    SessionSummary {
        id: document.id.clone(),
        title: document.title.clone(),
        updated_at: document.updated_at.clone(),
        slide_count: document.slides.len(),
        thumbnail_path: None,
        file_size: metadata.len(),
        modified_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn document(id: &str) -> TacticsSession {
        serde_json::from_value(serde_json::json!({
            "version": 1,
            "id": id,
            "title": "Contract session",
            "slides": [{
                "id": "slide-1",
                "title": "Build-up",
                "category": "buildup",
                "notes": "Notes",
                "players": [],
                "annotations": [],
                "ball": { "x": 8.8, "y": 34.0 }
            }],
            "showRoles": true,
            "smoothTransitions": true,
            "showCorridors": false,
            "updatedAt": "2026-01-01T00:00:00.000Z"
        }))
        .expect("valid test document")
    }

    #[test]
    fn session_contract() {
        let root = std::env::temp_dir().join(format!("tikitactic-contract-{}", Uuid::new_v4()));
        let original = document("session-contract");

        save(&root, &original).expect("save session");
        assert_eq!(list(&root).expect("list sessions").len(), 1);
        assert_eq!(
            load(&root, &original.id).expect("load session").title,
            original.title
        );

        let copy = duplicate(&root, &original.id, "Copy".into()).expect("duplicate session");
        assert_ne!(copy.id, original.id);
        assert_eq!(list(&root).expect("list both sessions").len(), 2);
        assert_eq!(load(&root, &copy.id).expect("load copy").title, "Copy");

        remove(&root, &original.id).expect("delete original");
        remove(&root, &copy.id).expect("delete copy");
        assert!(list(&root).expect("list empty repository").is_empty());
        assert!(load(&root, &original.id).is_err());

        fs::remove_dir_all(root).expect("remove test directory");
    }
}
