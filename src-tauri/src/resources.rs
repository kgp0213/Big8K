use std::path::{Path, PathBuf};

pub(crate) fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")))
        .to_path_buf()
}

pub(crate) fn project_file(path: &str) -> String {
    project_root().join(path).to_string_lossy().to_string()
}
