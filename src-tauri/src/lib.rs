mod adb;
mod adb_commands;
mod deploy_commands;
mod display_runtime;
mod framebuffer_commands;
mod host_env;
mod network_commands;
mod mipi_commands;
mod oled_config;
mod openclaw_actions;
mod openclaw_adapter;
mod openclaw_types;
mod preset_commands;

mod resources;
mod shell_utils;
mod ssh_commands;
mod state;

pub use state::ConnectionState;

pub(crate) use adb::{
    adb_push_internal, adb_shell_internal, resolve_device_id, run_adb, run_adb_nowait,
    run_remote_python_script,
};
pub(crate) use resources::project_file;
pub(crate) use shell_utils::shell_quote;

use adb_commands::{
    adb_connect, adb_devices, adb_disconnect, adb_pull, adb_push, adb_select_device, adb_shell,
};
use serde::{Deserialize, Serialize};
use deploy_commands::{
    delete_remote_file, deploy_install_app, deploy_install_tools, deploy_set_default_movie,
    deploy_set_default_pattern, deploy_set_graphical, deploy_set_multi_user, list_remote_files,
    run_remote_script, set_script_autorun, setup_loop_images, stop_remote_script,
    upload_file_base64,
};
use display_runtime::{
    display_image, display_image_from_base64, display_remote_image, get_video_playback_status,
    play_video, run_runtime_pattern, send_video_control, sync_runtime_patterns,
};
use framebuffer_commands::{
    adb_probe_device, clear_screen, create_image_preview, display_checkerboard,
    display_color_bar, display_gradient, display_solid_color, display_text,
    list_images_in_directory, pick_image_directory, read_power_rails, run_demo_screen,
    run_logic_pattern,
};
use host_env::get_local_network_info;
use network_commands::set_static_ip;
use mipi_commands::{
    mipi_read_power_mode, mipi_send_command, mipi_send_commands, mipi_sleep_in,
    mipi_sleep_out, mipi_software_reset,
};
use ssh_commands::{ssh_connect, ssh_exec};
use oled_config::{
    download_oled_config_and_reboot, export_oled_config_json, generate_timing_bin,
    parse_legacy_lcd_bin, pick_lcd_config_file,
};
use preset_commands::{load_cmdx_list, load_command_presets, save_cmdx_list, save_command_presets};
use std::sync::Mutex;


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdbDevice {
    pub id: String,
    pub status: String,
    pub product: Option<String>,
    pub model: Option<String>,
    pub transport_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdbDevicesResult {
    pub success: bool,
    pub devices: Vec<AdbDevice>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdbActionResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshConnectResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshExecResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PatternResult {
    pub success: bool,
    pub message: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenericResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceProbeResult {
    pub success: bool,
    pub model: Option<String>,
    pub panel_name: Option<String>,
    pub virtual_size: Option<String>,
    pub bits_per_pixel: Option<String>,
    pub mipi_mode: Option<String>,
    pub mipi_lanes: Option<u32>,
    pub fb0_available: bool,
    pub vismpwr_available: bool,
    pub python3_available: bool,
    pub cpu_usage: Option<String>,
    pub memory_usage: Option<String>,
    pub temperature_c: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TextDisplayRequest {
    pub text: String,
    pub subtitle: Option<String>,
    pub style: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageDisplayRequest {
    pub image_path: String,
    #[serde(default)]
    pub remote_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageDisplayFromBase64Request {
    #[serde(alias = "fileName")]
    pub filename: String,
    #[serde(alias = "base64Data")]
    pub base64_data: String,
    #[serde(default, alias = "remoteName")]
    pub remote_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogicPatternRequest {
    pub pattern: u8,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RuntimePatternRequest {
    pub pattern: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ListRemoteFilesRequest {
    path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ListRemoteFilesResult {
    success: bool,
    files: Vec<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UploadFileBase64Request {
    base64_data: String,
    remote_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RunRemoteScriptRequest {
    script_path: String,
    #[serde(default)]
    script_args: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SetScriptAutorunRequest {
    #[serde(alias = "script_name")]
    script_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DeleteRemoteFileRequest {
    file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SetupLoopImagesRequest {
    image_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayVideoRequest {
    pub video_path: String,
    pub zoom_mode: i32,
    pub show_framerate: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoControlRequest {
    pub action: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoPlaybackStatus {
    pub success: bool,
    pub is_running: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StaticIpRequest {
    pub ip: String,
    pub gateway: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimingBinRequest {
    pub pclk: u64,
    pub hact: u32,
    pub hfp: u32,
    pub hbp: u32,
    pub hsync: u32,
    pub vact: u32,
    pub vfp: u32,
    pub vbp: u32,
    pub vsync: u32,
    pub hs_polarity: bool,
    pub vs_polarity: bool,
    pub de_polarity: bool,
    pub clk_polarity: bool,
    pub interface_type: String,
    pub mipi_mode: String,
    pub video_type: String,
    pub lanes: u8,
    pub format: String,
    pub phy_mode: String,
    pub dsc_enable: bool,
    pub dsc_version: String,
    pub slice_width: u32,
    pub slice_height: u32,
    pub scrambling_enable: bool,
    pub data_swap: bool,
    pub panel_name: Option<String>,
    pub version: Option<String>,
    pub init_codes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadOledConfigRequest {
    pub request: TimingBinRequest,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LegacyTimingConfig {
    pub hact: u32,
    pub vact: u32,
    pub pclk: u64,
    pub hfp: u32,
    pub hbp: u32,
    pub hsync: u32,
    pub vfp: u32,
    pub vbp: u32,
    pub vsync: u32,
    pub hs_polarity: bool,
    pub vs_polarity: bool,
    pub de_polarity: bool,
    pub clk_polarity: bool,
    pub interface_type: String,
    pub mipi_mode: String,
    pub video_type: String,
    pub lanes: u8,
    pub format: String,
    pub phy_mode: String,
    pub dsc_enable: bool,
    pub dsc_version: String,
    pub slice_width: u32,
    pub slice_height: u32,
    pub scrambling_enable: bool,
    pub data_swap: bool,
    pub dual_channel: bool,
    pub panel_name: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LegacyLcdConfigResult {
    pub success: bool,
    pub path: Option<String>,
    pub timing: Option<LegacyTimingConfig>,
    pub init_codes: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PowerRailReading {
    pub name: String,
    pub addr: String,
    pub voltage: f64,
    pub current_ma: Option<f64>,
    pub power_mw: Option<f64>,
    pub status: String,
    pub gain_mode: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PowerRailsResult {
    pub success: bool,
    pub rails: Vec<PowerRailReading>,
    pub total_power_mw: Option<f64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandPresetItem {
    pub index: usize,
    pub name: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandPresetListResult {
    pub success: bool,
    pub items: Vec<CommandPresetItem>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalImageInfo {
    pub name: String,
    pub path: String,
    pub ext: String,
    pub modified_ms: Option<u128>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalImagesResult {
    pub success: bool,
    pub images: Vec<LocalImageInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImagePreviewResult {
    pub success: bool,
    pub data_url: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub error: Option<String>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(ConnectionState::default()))
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            adb_devices,
            adb_select_device,
            adb_connect,
            adb_disconnect,
            adb_shell,
            adb_push,
            adb_pull,
            adb_probe_device,
            get_local_network_info,
            set_static_ip,
            ssh_connect,
            ssh_exec,
            display_solid_color,
            display_gradient,
            display_color_bar,
            display_checkerboard,
            sync_runtime_patterns,
            run_runtime_pattern,
            read_power_rails,
            pick_image_directory,
            create_image_preview,
            list_images_in_directory,
            run_demo_screen,
            run_logic_pattern,
            display_text,
            display_image_from_base64,
            display_remote_image,
            display_image,
            setup_loop_images,
            play_video,
            get_video_playback_status,
            send_video_control,
            mipi_send_command,
            mipi_send_commands,
            mipi_software_reset,
            mipi_read_power_mode,
            mipi_sleep_in,
            mipi_sleep_out,
            clear_screen,
            pick_lcd_config_file,
            parse_legacy_lcd_bin,
            generate_timing_bin,
            export_oled_config_json,
            download_oled_config_and_reboot,
            load_cmdx_list,
            save_cmdx_list,
            load_command_presets,
            save_command_presets,
            deploy_install_tools,
            deploy_install_app,
            deploy_set_default_pattern,
            deploy_set_default_movie,
            deploy_set_multi_user,
            deploy_set_graphical,
            list_remote_files,
            upload_file_base64,
            run_remote_script,
            stop_remote_script,
            set_script_autorun,
            delete_remote_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
