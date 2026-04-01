use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkCard {
    pub name: String,
    pub ipv4: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalNetworkInfo {
    pub success: bool,
    pub cards: Vec<NetworkCard>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn get_local_network_info() -> LocalNetworkInfo {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("cmd")
            .args(["/C", "chcp 65001>nul & ipconfig"])
            .output();

        match output {
            Ok(result) => {
                if !result.status.success() {
                    return LocalNetworkInfo {
                        success: false,
                        cards: vec![],
                        error: Some("读取本机网络信息失败".to_string()),
                    };
                }

                let stdout = String::from_utf8_lossy(&result.stdout).to_string();
                let cards = parse_windows_ipconfig(&stdout);

                LocalNetworkInfo {
                    success: true,
                    cards,
                    error: None,
                }
            }
            Err(error) => LocalNetworkInfo {
                success: false,
                cards: vec![],
                error: Some(format!("读取本机网络信息异常: {}", error)),
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sh")
            .args(["-lc", "ip addr || ifconfig"])
            .output();

        match output {
            Ok(result) => {
                if !result.status.success() {
                    let stderr = String::from_utf8_lossy(&result.stderr).to_string();
                    return LocalNetworkInfo {
                        success: false,
                        cards: vec![],
                        error: Some(if stderr.trim().is_empty() {
                            "读取本机网络信息失败".to_string()
                        } else {
                            stderr
                        }),
                    };
                }

                let stdout = String::from_utf8_lossy(&result.stdout).to_string();
                let cards = parse_unix_network_info(&stdout);

                LocalNetworkInfo {
                    success: true,
                    cards,
                    error: None,
                }
            }
            Err(error) => LocalNetworkInfo {
                success: false,
                cards: vec![],
                error: Some(format!("读取本机网络信息异常: {}", error)),
            },
        }
    }
}

#[cfg(target_os = "windows")]
fn parse_windows_ipconfig(output: &str) -> Vec<NetworkCard> {
    let mut cards = vec![];
    let mut current_adapter: Option<String> = None;
    let mut current_ipv4: Option<String> = None;

    for line in output.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("Ethernet adapter") || trimmed.starts_with("Wireless LAN adapter") {
            let name = trimmed
                .replace("Ethernet adapter", "")
                .replace("Wireless LAN adapter", "")
                .trim()
                .trim_end_matches(':')
                .to_string();

            current_adapter = Some(name);
            current_ipv4 = None;
            continue;
        }

        if trimmed.contains("IPv4 Address") && trimmed.contains(':') {
            if let Some(pos) = trimmed.find(':') {
                let ip_formatted = trimmed[pos + 1..].trim();
                if !ip_formatted.is_empty() {
                    current_ipv4 = Some(ip_formatted.to_string());
                }
            }
            continue;
        }

        if trimmed.is_empty() || trimmed.starts_with("Ethernet adapter") || trimmed.starts_with("Wireless LAN adapter") {
            if let (Some(adapter), Some(ipv4)) = (&current_adapter, &current_ipv4) {
                let adapter_lower = adapter.to_lowercase();
                let is_virtual = adapter_lower.contains("vmware")
                    || adapter_lower.contains("vethernet")
                    || adapter_lower.contains("wsl")
                    || adapter_lower.contains("virtual")
                    || adapter_lower.contains("bluetooth")
                    || adapter_lower.contains("蓝牙");

                if !is_virtual {
                    cards.push(NetworkCard {
                        name: adapter.clone(),
                        ipv4: ipv4.clone(),
                    });
                }
            }

            if trimmed.starts_with("Ethernet adapter") || trimmed.starts_with("Wireless LAN adapter") {
                let name = trimmed
                    .replace("Ethernet adapter", "")
                    .replace("Wireless LAN adapter", "")
                    .trim()
                    .trim_end_matches(':')
                    .to_string();
                current_adapter = Some(name);
                current_ipv4 = None;
            } else {
                current_adapter = None;
                current_ipv4 = None;
            }
        }
    }

    if let (Some(adapter), Some(ipv4)) = (&current_adapter, &current_ipv4) {
        let adapter_lower = adapter.to_lowercase();
        let is_virtual = adapter_lower.contains("vmware")
            || adapter_lower.contains("vethernet")
            || adapter_lower.contains("wsl")
            || adapter_lower.contains("virtual")
            || adapter_lower.contains("bluetooth")
            || adapter_lower.contains("蓝牙");

        if !is_virtual {
            cards.push(NetworkCard {
                name: adapter.clone(),
                ipv4: ipv4.clone(),
            });
        }
    }

    cards
}

#[cfg(not(target_os = "windows"))]
fn parse_unix_network_info(output: &str) -> Vec<NetworkCard> {
    let mut cards = vec![];
    let mut current_adapter: Option<String> = None;

    for line in output.lines() {
        let trimmed = line.trim();

        if !trimmed.is_empty() && !trimmed.starts_with(' ') && !trimmed.starts_with('\t') {
            let name = trimmed.split([' ', ':']).next().unwrap_or("").trim();
            if !name.is_empty() && name != "lo" && !name.contains("docker") {
                current_adapter = Some(name.to_string());
            }
            continue;
        }

        if trimmed.contains("inet ") && !trimmed.contains("inet6") {
            if let Some(adapter) = &current_adapter {
                let parts = trimmed.split_whitespace().collect::<Vec<_>>();
                if let Some(ip_pos) = parts.iter().position(|p| p == "inet") {
                    if let Some(ip) = parts.get(ip_pos + 1) {
                        let adapter_lower = adapter.to_lowercase();
                        let is_virtual = adapter_lower.contains("vmware")
                            || adapter_lower.contains("veth")
                            || adapter_lower.contains("docker")
                            || adapter_lower.contains("virbr");

                        if !is_virtual {
                            cards.push(NetworkCard {
                                name: adapter.clone(),
                                ipv4: ip.to_string(),
                            });
                        }
                    }
                }
            }
        }

        if trimmed.contains("inet ") && trimmed.contains('/') && !trimmed.contains("inet6") {
            if let Some(adapter) = &current_adapter {
                let parts = trimmed.split_whitespace().collect::<Vec<_>>();
                for part in parts {
                    if part.starts_with("inet ") {
                        continue;
                    }
                    if part.contains('/') && part.contains('.') {
                        let ip = part.split('/').next().unwrap_or("").trim();
                        if !ip.is_empty() {
                            let adapter_lower = adapter.to_lowercase();
                            let is_virtual = adapter_lower.contains("vmware")
                                || adapter_lower.contains("veth")
                                || adapter_lower.contains("docker")
                                || adapter_lower.contains("virbr");

                            if !is_virtual {
                                cards.push(NetworkCard {
                                    name: adapter.clone(),
                                    ipv4: ip.to_string(),
                                });
                            }
                        }
                        break;
                    }
                }
            }
        }
    }

    cards
}
