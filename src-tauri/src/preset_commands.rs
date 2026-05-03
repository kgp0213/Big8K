use crate::{CommandPresetItem, CommandPresetListResult, GenericResult};

fn command_preset_data_paths() -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let exe = std::env::current_exe().map_err(|e| format!("无法定位可执行文件路径: {}", e))?;
    let dir = exe.parent().ok_or_else(|| "无法定位可执行文件目录".to_string())?;
    Ok((dir.join("command_presets.json"), dir.join("cmdx_list.json")))
}

// 旧命令名兼容入口：保留给历史前端版本使用。
#[tauri::command]
pub fn load_cmdx_list() -> CommandPresetListResult {
    let mut items: Vec<CommandPresetItem> = (1..=30)
        .map(|i| CommandPresetItem {
            index: i - 1,
            name: format!("{:02}-CMD", i),
            content: String::new(),
        })
        .collect();

    let (primary_path, legacy_path) = match command_preset_data_paths() {
        Ok(paths) => paths,
        Err(err) => {
            return CommandPresetListResult { success: false, items, error: Some(err) };
        }
    };

    let path_to_read = if primary_path.exists() {
        primary_path.clone()
    } else {
        legacy_path.clone()
    };

    if path_to_read.exists() {
        match std::fs::read_to_string(&path_to_read) {
            Ok(raw) => match serde_json::from_str::<Vec<CommandPresetItem>>(&raw) {
                Ok(mut loaded) => {
                    loaded.sort_by_key(|item| item.index);
                    if !loaded.is_empty() {
                        items = loaded;
                    }
                    let note = if path_to_read == legacy_path {
                        Some(format!("已兼容读取旧命令清单文件: {}；后续保存将写入新文件 command_presets.json", legacy_path.display()))
                    } else {
                        None
                    };
                    CommandPresetListResult { success: true, items, error: note }
                }
                Err(err) => CommandPresetListResult { success: false, items, error: Some(format!("命令清单解析失败: {}", err)) },
            },
            Err(err) => CommandPresetListResult { success: false, items, error: Some(format!("读取命令清单失败: {}", err)) },
        }
    } else {
        CommandPresetListResult { success: true, items, error: None }
    }
}

// 旧命令名兼容入口：保留给历史前端版本使用。
#[tauri::command]
pub fn save_cmdx_list(items: Vec<CommandPresetItem>) -> GenericResult {
    let (primary_path, _) = match command_preset_data_paths() {
        Ok(paths) => paths,
        Err(err) => {
            return GenericResult { success: false, output: String::new(), error: Some(err) };
        }
    };

    let mut sorted = items;
    sorted.sort_by_key(|item| item.index);

    match serde_json::to_string_pretty(&sorted) {
        Ok(json) => match std::fs::write(&primary_path, json) {
            Ok(_) => GenericResult { success: true, output: format!("已保存命令清单: {}", primary_path.display()), error: None },
            Err(err) => GenericResult { success: false, output: String::new(), error: Some(format!("写入命令清单失败: {}", err)) },
        },
        Err(err) => GenericResult { success: false, output: String::new(), error: Some(format!("序列化命令清单失败: {}", err)) },
    }
}

// 新命令名：供当前前端与后续版本使用。
#[tauri::command]
pub fn load_command_presets() -> CommandPresetListResult {
    load_cmdx_list()
}

// 新命令名：供当前前端与后续版本使用。
#[tauri::command]
pub fn save_command_presets(items: Vec<CommandPresetItem>) -> GenericResult {
    save_cmdx_list(items)
}
