use std::sync::Arc;

use rmcp::{
    const_string, model::*, schemars, service::RequestContext, tool, Error as McpError, RoleServer,
    ServerHandler,
};
use tokio::sync::Mutex;

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct StructRequest {
    pub a: i32,
    pub b: i32,
}

#[derive(Clone)]
pub struct Tools {
    counter: Arc<Mutex<i32>>,
}

#[tool(tool_box)]
impl Tools {
    pub fn new(counter: Arc<Mutex<i32>>) -> Self {
        Self { counter }
    }

    #[tool(description = "Increment the counter by 1 and get the value of counter after increment")]
    async fn increment(&self) -> Result<CallToolResult, McpError> {
        let mut counter = self.counter.lock().await;
        *counter += 1;
        Ok(CallToolResult::success(vec![Content::text(
            counter.to_string(),
        )]))
    }

    #[tool(description = "Decrement the counter by 1, and get the value of counter after decrement")]
    async fn decrement(&self) -> Result<CallToolResult, McpError> {
        let mut counter = self.counter.lock().await;
        *counter -= 1;
        Ok(CallToolResult::success(vec![Content::text(
            counter.to_string(),
        )]))
    }

    #[tool(description = "Get the current counter value")]
    async fn get_value(&self) -> Result<CallToolResult, McpError> {
        let counter = self.counter.lock().await;
        Ok(CallToolResult::success(vec![Content::text(
            counter.to_string(),
        )]))
    }

    #[tool(description = "Say hello to the client")]
    fn say_hello(&self) -> Result<CallToolResult, McpError> {
        Ok(CallToolResult::success(vec![Content::text("Bonjour!")]))
    }

    #[tool(name="today_weather", description = "Get today weather")]
    fn get_today_weather(&self) -> Result<CallToolResult, McpError> {
        Ok(CallToolResult::success(vec![Content::text("Rainy")]))
    }

    #[tool(description = "Repeat what you say")]
    fn echo(
        &self,
        #[tool(param)]
        #[schemars(description = "Repeat what you say")]
        saying: String,
    ) -> Result<CallToolResult, McpError> {
        Ok(CallToolResult::success(vec![Content::text(saying)]))
    }

    #[tool(description = "Calculate the sum of two numbers")]
    fn sum(
        &self,
        #[tool(aggr)] StructRequest { a, b }: StructRequest,
    ) -> Result<CallToolResult, McpError> {
        Ok(CallToolResult::success(vec![Content::text(
            (a + b).to_string(),
        )]))
    }
}
const_string!(Echo = "echo");
#[tool(tool_box)]
impl ServerHandler for Tools {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::V_2024_11_05,
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .build(),
            server_info: Implementation::from_build_env(),
            instructions: Some("This server provides a counter tool that can increment and decrement values. The counter starts at 0 and can be modified using the 'increment' and 'decrement' tools. Use 'get_value' to check the current count.".to_string()),
        }
    }

    async fn initialize(
        &self,
        _request: InitializeRequestParam,
        _context: RequestContext<RoleServer>,
    ) -> Result<InitializeResult, McpError> {
        Ok(self.get_info())
    }
}
