use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TacticsSession {
    pub version: u32,
    pub id: String,
    pub title: String,
    pub slides: Vec<Slide>,
    pub show_roles: bool,
    #[serde(default = "default_true")]
    pub smooth_transitions: bool,
    #[serde(default)]
    pub show_corridors: bool,
    pub updated_at: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Slide {
    pub id: String,
    pub title: String,
    pub category: Category,
    pub notes: String,
    pub players: Vec<Player>,
    pub annotations: Vec<Annotation>,
    pub ball: Point,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Player {
    pub id: String,
    pub team: Team,
    pub number: u32,
    pub role: String,
    pub x: f64,
    pub y: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Annotation {
    pub id: String,
    #[serde(rename = "type")]
    pub annotation_type: AnnotationType,
    pub points: Vec<Point>,
    pub color: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Team {
    Home,
    Away,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Buildup,
    Defence,
    Setpiece,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AnnotationType {
    Run,
    Pass,
    Line,
    Draw,
    Zone,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    pub slide_count: usize,
    pub thumbnail_path: Option<String>,
    pub file_size: u64,
    pub modified_ms: u64,
}

fn default_true() -> bool {
    true
}
