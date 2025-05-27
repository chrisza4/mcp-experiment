use std::sync::Arc;

use rmcp::transport::sse_server::SseServer;
use tokio::sync::Mutex;
use tools::Tools;
use tracing_subscriber::{
    layer::SubscriberExt,
    util::SubscriberInitExt,
    {self},
};
use tracing::info;
mod tools;

const BIND_ADDRESS: &str = "127.0.0.1:8000";

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "debug".to_string().into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
    info!("==hello==");
    let counter = Arc::new(Mutex::new(0));
    let ct = SseServer::serve(BIND_ADDRESS.parse()?)
        .await?
        .with_service(move || Tools::new(counter.clone()));

    tokio::signal::ctrl_c().await?;
    ct.cancel();
    Ok(())
}
