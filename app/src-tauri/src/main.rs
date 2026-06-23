// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use tauri::ipc::Response;

fn mock_file_path() -> Result<PathBuf, String> {
    if !tauri::is_dev() {
        return Err(String::from("mock file is only supported in development"));
    }
    let tauri_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    match tauri_dir.parent() {
        None => Err(String::from("path had no parent")),
        Some(path) => Ok(path.join("data/mock.json")),
    }
}

#[tauri::command]
fn write_mock_file(contents: String) -> Result<(), String> {
    std::fs::write(mock_file_path()?, contents.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_mock_file() -> Result<Response, String> {
    let data = std::fs::read(mock_file_path()?).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(data))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![write_mock_file, read_mock_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
