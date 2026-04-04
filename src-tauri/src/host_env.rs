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

#[cfg(target_os = "windows")]
#[derive(Debug, Deserialize)]
struct PowerShellNetworkAdapter {
    #[serde(rename = "InterfaceAlias")]
    interface_alias: Option<String>,
    #[serde(rename = "IPv4Address")]
    ipv4_address: Option<Vec<PowerShellIpv4Address>>,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Deserialize)]
struct PowerShellIpv4Address {
    #[serde(rename = "IPAddress")]
    ip_address: Option<String>,
}

#[tauri::command]
pub fn get_local_network_info() -> LocalNetworkInfo {
    #[cfg(target_os = "windows")]
    {
        if let Ok(cards) = get_windows_network_cards_via_powershell() {
            return LocalNetworkInfo {
                success: true,
                cards,
                error: None,
            };
        }

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
fn get_windows_network_cards_via_powershell() -> Result<Vec<NetworkCard>, String> {
    let script = r#"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Get-NetIPConfiguration |
  Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4Address } |
  Select-Object InterfaceAlias, IPv4Address |
  ConvertTo-Json -Compress"#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "PowerShell 读取网卡信息失败".to_string()
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        return Ok(vec![]);
    }

    let adapters: Vec<PowerShellNetworkAdapter> = if stdout.starts_with('[') {
        serde_json::from_str(&stdout).map_err(|error| error.to_string())?
    } else {
        vec![serde_json::from_str(&stdout).map_err(|error| error.to_string())?]
    };

    let mut cards = vec![];
    for adapter in adapters {
        let Some(name) = adapter.interface_alias.map(|value| value.trim().to_string()) else {
            continue;
        };

        if name.is_empty() || is_virtual_adapter_name(&name) {
            continue;
        }

        let Some(addresses) = adapter.ipv4_address else {
            continue;
        };

        for address in addresses {
            let Some(ipv4) = address.ip_address.map(|value| value.trim().to_string()) else {
                continue;
            };

            if ipv4.is_empty() || ipv4.starts_with("169.254.") || ipv4 == "127.0.0.1" {
                continue;
            }

            cards.push(NetworkCard {
                name: name.clone(),
                ipv4,
            });
        }
    }

    Ok(cards)
}

#[cfg(target_os = "windows")]
fn is_virtual_adapter_name(name: &str) -> bool {
    let adapter_lower = name.to_lowercase();
    adapter_lower.contains("vmware")
        || adapter_lower.contains("vethernet")
        || adapter_lower.contains("wsl")
        || adapter_lower.contains("virtual")
        || adapter_lower.contains("bluetooth")
        || adapter_lower.contains("蓝牙")
        || adapter_lower.contains("hyper-v")
        || adapter_lower.contains("loopback")
        || adapter_lower.contains("pseudo")
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
                if !is_virtual_adapter_name(adapter) {
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
        if !is_virtual_adapter_name(adapter) {
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
