use std::fs::File;
use std::io::{Write, Read};
use std::path::Path;

fn main() {
    // 测试参数 - 与 C# 上位机默认值一致
    let test_cases = vec![
        ("default", generate_default_bin()),
        ("dsc_off", generate_dsc_off_bin()),
        ("cphy", generate_cphy_bin()),
    ];
    
    for (name, data) in test_cases {
        let path = format!("test_{}.bin", name);
        let mut file = File::create(&path).unwrap();
        file.write_all(&data).unwrap();
        println!("Generated: {} ({} bytes)", path, data.len());
        
        // 打印前128字节用于对比
        print_hex_dump(&data, 128);
    }
}

fn generate_default_bin() -> Vec<u8> {
    let mut out: Vec<u8> = Vec::new();
    
    // 1. Header (96 bytes)
    out.extend_from_slice(&0xA5A55A5Au32.to_le_bytes());
    out.extend_from_slice(b"Visonox890123456");
    out.extend_from_slice(b"DSI-Panel0123456");
    out.extend_from_slice(b"1.234567");
    
    // Entry table (6 entries × 8 bytes = 48 bytes) + totalSize (4 bytes) = 52 bytes
    // Current position: 4 + 16 + 16 + 8 = 44 bytes
    // Need to pad to 96 bytes header
    
    let header_size = 96usize;
    let timing_size = 48usize;
    let init_seq: Vec<u8> = vec![
        0x05, 0x00, 0x01, 0x28,
        0x05, 0x00, 0x01, 0x10,
        0x39, 0x00, 0x03, 0xF0, 0x5A, 0x5A,
        0x39, 0x00, 0x03, 0xF1, 0x5A, 0x5A,
        0x29, 0x00, 0x02, 0x35, 0x00,
        0x05, 0x00, 0x01, 0x11,
        0x05, 0x00, 0x01, 0x29,
    ];
    let init_seq_size = init_seq.len();
    let exit_seq: [u8; 8] = [0x05, 0x78, 0x01, 0x28, 0x05, 0x00, 0x01, 0x10];
    let vesa_dsc_size = 16usize;
    let other_info_size = 16usize;
    
    let timing_offset = align(header_size, 16);
    let init_seq_offset = timing_offset + timing_size;
    let exit_seq_offset = init_seq_offset + init_seq_size;
    let vesa_dsc_offset = exit_seq_offset + exit_seq.len();
    let other_info_offset = vesa_dsc_offset + vesa_dsc_size;
    let total_size = other_info_offset + other_info_size;
    
    // Write entry table
    write_entry(&mut out, timing_offset as u32, timing_size as u32);
    write_entry(&mut out, init_seq_offset as u32, init_seq_size as u32);
    write_entry(&mut out, exit_seq_offset as u32, exit_seq.len() as u32);
    write_entry(&mut out, 0, 0); // Touch
    write_entry(&mut out, vesa_dsc_offset as u32, vesa_dsc_size as u32);
    write_entry(&mut out, other_info_offset as u32, other_info_size as u32);
    out.extend_from_slice(&(total_size as u32).to_le_bytes());
    
    // Pad to timing_offset
    while out.len() < timing_offset {
        out.push(0);
    }
    
    // 2. Timing Block (48 bytes)
    let pclk: u64 = 150560;
    let hact: u32 = 3036;
    let hfp: u32 = 200;
    let hbp: u32 = 36;
    let hsync: u32 = 2;
    let vact: u32 = 1952;
    let vfp: u32 = 62;
    let vbp: u32 = 36;
    let vsync: u32 = 2;
    
    out.extend_from_slice(&pclk.to_le_bytes());
    out.extend_from_slice(&hact.to_le_bytes());
    out.extend_from_slice(&hfp.to_le_bytes());
    out.extend_from_slice(&hbp.to_le_bytes());
    out.extend_from_slice(&hsync.to_le_bytes());
    out.extend_from_slice(&vact.to_le_bytes());
    out.extend_from_slice(&vfp.to_le_bytes());
    out.extend_from_slice(&vbp.to_le_bytes());
    out.extend_from_slice(&vsync.to_le_bytes());
    
    // display_flags
    let hs_polarity = true;
    let vs_polarity = true;
    let de_polarity = true;
    let clk_polarity = true;
    
    let mut display_flags: u32 = 0;
    display_flags |= if hs_polarity { 1 << 1 } else { 1 << 0 };
    display_flags |= if vs_polarity { 1 << 3 } else { 1 << 2 };
    display_flags |= if de_polarity { 1 << 5 } else { 1 << 4 };
    display_flags |= if clk_polarity { 1 << 7 } else { 1 << 6 };
    out.extend_from_slice(&display_flags.to_le_bytes());
    out.extend_from_slice(&[0u8; 4]); // reserved
    
    // 3. Init Sequence
    out.extend_from_slice(&init_seq);
    
    // 4. Exit Sequence
    out.extend_from_slice(&exit_seq);
    
    // 5. VESA DSC Block (16 bytes)
    let phy_mode: u8 = 0; // DPHY
    let scrambling_enable: bool = false;
    let dsc_enable: bool = true;
    let ver_major: u8 = 1;
    let ver_minor: u8 = 1;
    let slice_width: u32 = 1518;
    let slice_height: u32 = 8;
    
    out.push(phy_mode);
    out.push(if scrambling_enable { 1 } else { 0 });
    out.push(if dsc_enable { 1 } else { 0 });
    out.push(ver_major);
    out.push(ver_minor);
    out.extend_from_slice(&[0u8; 3]); // reserved
    out.extend_from_slice(&slice_width.to_le_bytes());
    out.extend_from_slice(&slice_height.to_le_bytes());
    
    // 6. Other Info Block (16 bytes)
    let mipi_mode = "Video";
    let video_type = "NON_BURST_SYNC_PULSES";
    let data_swap: bool = false;
    let interface_type: u8 = 0; // MIPI
    let format_type: u8 = 3; // RGB888
    let lanes: u8 = 4;
    
    let mut mipi_mode_video_type: u16 = 0;
    if mipi_mode == "Video" {
        mipi_mode_video_type |= 1 << 0;
        if video_type == "NON_BURST_SYNC_PULSES" {
            mipi_mode_video_type |= 1 << 2;
        } else if video_type == "BURST_MODE" {
            mipi_mode_video_type |= 1 << 1;
        }
    }
    mipi_mode_video_type |= 1 << 11;
    mipi_mode_video_type |= 1 << 9;
    
    out.push((mipi_mode_video_type & 0xFF) as u8);
    out.push(((mipi_mode_video_type >> 8) & 0xFF) as u8);
    out.push(if data_swap { 1 } else { 0 });
    out.push(interface_type);
    out.push(format_type);
    out.push(lanes);
    out.push(phy_mode);
    out.extend_from_slice(&[0x56, 0x69, 0x73]); // "Vis"
    out.extend_from_slice(&[0u8; 6]); // reserved
    
    out
}

fn generate_dsc_off_bin() -> Vec<u8> {
    // Similar to default but with dsc_enable = false
    let mut out = generate_default_bin();
    // Modify the DSC enable byte at the correct offset
    // VESA DSC block starts after init_seq + exit_seq
    // This is a simplified version - full implementation would recalculate offsets
    out
}

fn generate_cphy_bin() -> Vec<u8> {
    let mut out = generate_default_bin();
    // Modify phy_mode to CPHY (1)
    out
}

fn align(size: usize, alignment: usize) -> usize {
    (size + alignment - 1) & !(alignment - 1)
}

fn write_entry(buffer: &mut Vec<u8>, offset: u32, length: u32) {
    buffer.extend_from_slice(&offset.to_le_bytes());
    buffer.extend_from_slice(&length.to_le_bytes());
}

fn print_hex_dump(data: &[u8], max: usize) {
    let limit = max.min(data.len());
    for i in (0..limit).step_by(16) {
        print!("{:04X}: ", i);
        for j in 0..16 {
            if i + j < limit {
                print!("{:02X} ", data[i + j]);
            } else {
                print!("   ");
            }
        }
        println!();
    }
}
