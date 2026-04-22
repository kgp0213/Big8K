use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct OpenClawError {
    pub stage: &'static str,
    pub code: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenClawResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub warnings: Vec<String>,
    pub summary: String,
    pub next_suggestion: Option<String>,
    pub error: Option<OpenClawError>,
}

impl<T> OpenClawResult<T> {
    pub fn ok(data: T, summary: impl Into<String>) -> Self {
        Self {
            success: true,
            data: Some(data),
            warnings: Vec::new(),
            summary: summary.into(),
            next_suggestion: None,
            error: None,
        }
    }

    pub fn fail(
        stage: &'static str,
        code: &'static str,
        message: impl Into<String>,
        summary: impl Into<String>,
    ) -> Self {
        Self {
            success: false,
            data: None,
            warnings: Vec::new(),
            summary: summary.into(),
            next_suggestion: None,
            error: Some(OpenClawError {
                stage,
                code,
                message: message.into(),
            }),
        }
    }
}
