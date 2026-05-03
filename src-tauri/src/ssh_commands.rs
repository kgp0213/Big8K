#[cfg(feature = "ssh")]
use ssh2::Session;
#[cfg(feature = "ssh")]
use std::io::Read;
#[cfg(feature = "ssh")]
use std::net::{TcpStream, ToSocketAddrs};
#[cfg(feature = "ssh")]
use std::time::Duration;

use crate::{SshConnectResult, SshExecResult};

#[cfg(feature = "ssh")]
fn ssh_connect_session(host: &str, port: u16, username: &str, password: &str) -> Result<Session, String> {
    let target = format!("{}:{}", host, port);
    let addr = match target.to_socket_addrs() {
        Ok(mut addrs) => addrs.next().ok_or_else(|| format!("SSH connection failed: invalid address {}", target))?,
        Err(e) => return Err(format!("SSH connection failed: {}", e)),
    };

    let tcp = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
        .map_err(|e| format!("SSH connection failed: {}", e))?;

    let _ = tcp.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = tcp.set_write_timeout(Some(Duration::from_secs(5)));

    let mut session = Session::new().map_err(|e| format!("SSH session init failed: {}", e))?;
    session.set_tcp_stream(tcp);
    session.set_timeout(5000);

    session.handshake().map_err(|e| format!("SSH handshake failed: {}", e))?;
    session
        .userauth_password(username, password)
        .map_err(|e| format!("SSH authentication failed: {}", e))?;

    if !session.authenticated() {
        return Err("SSH authentication failed: unknown reason".to_string());
    }

    Ok(session)
}

#[cfg(feature = "ssh")]
#[tauri::command]
pub fn ssh_connect(host: String, port: u16, username: String, password: String) -> SshConnectResult {
    match ssh_connect_session(&host, port, &username, &password) {
        Ok(_) => SshConnectResult {
            success: true,
            output: format!("SSH connected to {}@{}:{}", username, host, port),
            error: None,
        },
        Err(error) => SshConnectResult {
            success: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

#[cfg(not(feature = "ssh"))]
#[tauri::command]
pub fn ssh_connect(_host: String, _port: u16, _username: String, _password: String) -> SshConnectResult {
    SshConnectResult {
        success: false,
        output: String::new(),
        error: Some("当前构建未启用 SSH 功能".to_string()),
    }
}

#[cfg(feature = "ssh")]
#[tauri::command]
pub fn ssh_exec(host: String, port: u16, username: String, password: String, command: String) -> SshExecResult {
    let session = match ssh_connect_session(&host, port, &username, &password) {
        Ok(session) => session,
        Err(error) => {
            return SshExecResult {
                success: false,
                output: String::new(),
                error: Some(error),
            }
        }
    };

    let mut channel = match session.channel_session() {
        Ok(channel) => channel,
        Err(error) => {
            return SshExecResult {
                success: false,
                output: String::new(),
                error: Some(format!("SSH channel open failed: {}", error)),
            }
        }
    };

    if let Err(error) = channel.exec(&command) {
        return SshExecResult {
            success: false,
            output: String::new(),
            error: Some(format!("SSH exec failed: {}", error)),
        };
    }

    let mut stdout = String::new();
    let mut stderr = String::new();
    let _ = std::io::Read::read_to_string(&mut channel, &mut stdout);
    let _ = std::io::Read::read_to_string(&mut channel.stderr(), &mut stderr);
    let _ = channel.wait_close();
    let exit_code = channel.exit_status().unwrap_or(1);

    if exit_code == 0 {
        SshExecResult {
            success: true,
            output: stdout,
            error: if stderr.trim().is_empty() { None } else { Some(stderr) },
        }
    } else {
        SshExecResult {
            success: false,
            output: stdout,
            error: Some(if stderr.trim().is_empty() {
                format!("SSH command exited with code {}", exit_code)
            } else {
                stderr
            }),
        }
    }
}

#[cfg(not(feature = "ssh"))]
#[tauri::command]
pub fn ssh_exec(_host: String, _port: u16, _username: String, _password: String, _command: String) -> SshExecResult {
    SshExecResult {
        success: false,
        output: String::new(),
        error: Some("当前构建未启用 SSH 功能".to_string()),
    }
}
