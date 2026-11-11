use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SessionError {
    pub code: &'static str,
    pub message: String,
}

impl SessionError {
    pub fn not_found() -> Self {
        Self {
            code: "not_found",
            message: "Session not found".into(),
        }
    }

    pub fn invalid_document() -> Self {
        Self {
            code: "invalid_document",
            message: "The session document is invalid".into(),
        }
    }

    pub fn storage() -> Self {
        Self {
            code: "storage",
            message: "Session storage is unavailable".into(),
        }
    }
}
