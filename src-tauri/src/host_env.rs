use network_interface::{Addr, NetworkInterface, NetworkInterfaceConfig};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::net::Ipv4Addr;

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
pub async fn get_local_network_info() -> LocalNetworkInfo {
    tauri::async_runtime::spawn_blocking(get_local_network_info_blocking)
        .await
        .unwrap_or_else(|error| LocalNetworkInfo {
            success: false,
            cards: vec![],
            error: Some(format!("读取本机网络信息异常: {}", error)),
        })
}

fn get_local_network_info_blocking() -> LocalNetworkInfo {
    match NetworkInterface::show() {
        Ok(interfaces) => {
            let mut cards = Vec::new();
            let mut seen = HashSet::new();

            for interface in interfaces {
                let name = interface.name.trim().to_string();
                if name.is_empty() || should_skip_adapter_name(&name) {
                    continue;
                }

                for addr in interface.addr {
                    let ipv4 = match addr {
                        Addr::V4(value) => value.ip,
                        Addr::V6(_) => continue,
                    };

                    if !should_include_ipv4(ipv4) || should_filter_adapter(&name, ipv4) {
                        continue;
                    }

                    let key = format!("{}|{}", name, ipv4);
                    if seen.insert(key) {
                        cards.push(NetworkCard {
                            name: name.clone(),
                            ipv4: ipv4.to_string(),
                        });
                    }
                }
            }

            cards.sort_by(sort_network_cards);

            LocalNetworkInfo {
                success: true,
                cards,
                error: None,
            }
        }
        Err(error) => LocalNetworkInfo {
            success: false,
            cards: vec![],
            error: Some(format!("读取本机网络信息失败: {}", error)),
        },
    }
}

fn sort_network_cards(a: &NetworkCard, b: &NetworkCard) -> std::cmp::Ordering {
    network_priority(&a.name)
        .cmp(&network_priority(&b.name))
        .then(a.name.cmp(&b.name))
        .then(a.ipv4.cmp(&b.ipv4))
}

fn network_priority(name: &str) -> u8 {
    if is_wireless_adapter_name(name) {
        0
    } else if is_preferred_lan_adapter_name(name) {
        1
    } else {
        2
    }
}

fn is_preferred_lan_adapter_name(name: &str) -> bool {
    let normalized = name.to_lowercase();
    normalized.starts_with("eth") || normalized.starts_with("ethernet") || name.contains("以太网")
}

fn is_wireless_adapter_name(name: &str) -> bool {
    let normalized = name.to_lowercase();
    normalized.contains("wi-fi")
        || normalized.contains("wifi")
        || normalized.contains("wlan")
        || normalized.contains("wireless")
        || name.contains("无线")
}

fn should_include_ipv4(ip: Ipv4Addr) -> bool {
    !ip.is_loopback() && !ip.is_unspecified()
}

fn should_filter_adapter(name: &str, ip: Ipv4Addr) -> bool {
    let normalized = name.to_lowercase();

    if ip.octets()[0] == 169 && ip.octets()[1] == 254 {
        if normalized.starts_with("本地连接*")
            || normalized.starts_with("local area connection*")
            || normalized.contains("bluetooth")
            || name.contains("蓝牙")
            || normalized.contains("wi-fi direct")
            || normalized.contains("microsoft wi-fi direct")
        {
            return true;
        }
    }

    is_virtual_adapter_name(name)
}

fn should_skip_adapter_name(name: &str) -> bool {
    let normalized = name.to_lowercase();
    normalized.starts_with("loopback")
        || normalized.starts_with("isatap")
        || normalized.starts_with("teredo")
        || normalized.starts_with("local area connection*")
        || normalized.starts_with("本地连接*")
}

fn is_virtual_adapter_name(name: &str) -> bool {
    let adapter_lower = name.to_lowercase();
    adapter_lower.contains("vmware")
        || adapter_lower.contains("vethernet")
        || adapter_lower.contains("wsl")
        || adapter_lower.contains("hyper-v")
        || adapter_lower.contains("docker")
        || adapter_lower.contains("br-")
        || adapter_lower.contains("virbr")
        || adapter_lower.contains("veth")
        || adapter_lower.contains("loopback")
        || adapter_lower.contains("pseudo")
        || adapter_lower.contains("tunnel")
        || adapter_lower.contains("microsoft kernel debug")
}
