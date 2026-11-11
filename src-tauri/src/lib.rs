mod commands;
mod error;
mod models;
mod paths;
mod repository;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::sessions::list_sessions,
            commands::sessions::load_session,
            commands::sessions::save_session,
            commands::sessions::duplicate_session,
            commands::sessions::delete_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running TikiTactic");
}
