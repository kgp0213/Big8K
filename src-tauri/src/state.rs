use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionState {
    pub selected_device_id: Option<String>,
}

impl Default for ConnectionState {
    fn default() -> Self {
        Self {
            selected_device_id: None,
        }
    }
}
