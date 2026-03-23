use ssh2::Session;
use std::io::Read;
use std::net::TcpStream;
use std::path::Path;
use std::time::Duration;

fn main() {
    let host = "192.168.137.100";
    let tcp = match TcpStream::connect((host, 22)) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("TCP_FAIL {e}");
            std::process::exit(2);
        }
    };
    tcp.set_read_timeout(Some(Duration::from_secs(5))).ok();
    tcp.set_write_timeout(Some(Duration::from_secs(5))).ok();

    let mut sess = match Session::new() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("SESSION_FAIL {e}");
            std::process::exit(3);
        }
    };
    sess.set_tcp_stream(tcp);
    sess.set_timeout(5000);
    if let Err(e) = sess.handshake() {
        eprintln!("HANDSHAKE_FAIL {e}");
        std::process::exit(4);
    }
    if let Err(e) = sess.userauth_password("root", "Rk3588@2026!") {
        eprintln!("AUTH_FAIL {e}");
        std::process::exit(5);
    }
    if !sess.authenticated() {
        eprintln!("AUTH_FAIL not authenticated");
        std::process::exit(6);
    }

    let mut ch = match sess.channel_session() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("CHANNEL_FAIL {e}");
            std::process::exit(7);
        }
    };
    if let Err(e) = ch.exec("uname -a && whoami && pwd") {
        eprintln!("EXEC_FAIL {e}");
        std::process::exit(8);
    }
    let mut out = String::new();
    if let Err(e) = ch.read_to_string(&mut out) {
        eprintln!("READ_FAIL {e}");
        std::process::exit(9);
    }
    let _ = ch.wait_close();

    let sftp = match sess.sftp() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("SFTP_INIT_FAIL {e}");
            std::process::exit(10);
        }
    };
    let entries = match sftp.readdir(Path::new("/vismm")) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("SFTP_READDIR_FAIL {e}");
            std::process::exit(11);
        }
    };

    println!("OK");
    println!("EXEC_OUTPUT_START");
    println!("{}", out.trim());
    println!("EXEC_OUTPUT_END");
    println!("SFTP_ENTRIES={}", entries.len());
}
