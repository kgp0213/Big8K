use ssh2::Session;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

fn main() {
    let host = "192.168.137.100";
    let port = 22;
    let username = "root";
    let password = "Rk3588@2026!";

    println!("Testing SSH to {}:{} as {}...", host, port, username);

    let target = format!("{}:{}", host, port);
    let addr = match target.to_socket_addrs() {
        Ok(mut addrs) => match addrs.next() {
            Some(addr) => addr,
            None => {
                println!("FAIL: invalid address {}", target);
                return;
            }
        },
        Err(e) => {
            println!("FAIL: DNS/address error: {}", e);
            return;
        }
    };

    println!("Resolved addr: {:?}", addr);

    let tcp = match TcpStream::connect_timeout(&addr, Duration::from_secs(5)) {
        Ok(stream) => {
            println!("TCP connected!");
            stream
        }
        Err(e) => {
            println!("FAIL: TCP connection failed: {}", e);
            return;
        }
    };

    let mut session = match Session::new() {
        Ok(s) => s,
        Err(e) => {
            println!("FAIL: session init failed: {}", e);
            return;
        }
    };

    session.set_tcp_stream(tcp);
    session.set_timeout(5000);

    if let Err(e) = session.handshake() {
        println!("FAIL: SSH handshake failed: {}", e);
        return;
    }
    println!("SSH handshake OK!");

    if let Err(e) = session.userauth_password(username, password) {
        println!("FAIL: SSH auth failed: {}", e);
        return;
    }

    if session.authenticated() {
        println!("SUCCESS: SSH authenticated!");
    } else {
        println!("FAIL: not authenticated");
    }
}
