import {
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import readline from "readline/promises"
import dotenv from "dotenv"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { geminiQuery } from "./gemini"
import { claudeQuery } from "./claude"
import { Logger } from "./logger"
import Anthropic from "@anthropic-ai/sdk"
import { Content } from "@google/genai"

dotenv.config()
const logger = new Logger()

class MCPClient {
  private mcp: Client
  private transport: Transport | null = null
  private tools: Tool[] = []
  private previousMessages: Anthropic.Messages.MessageParam[] | Content[] = []
  private rl: readline.Interface

  constructor() {
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" })
    this.rl = readline.createInterface(
      process.stdin as NodeJS.ReadableStream,
      process.stdout as NodeJS.WritableStream
    )
  }
  // methods will go here
  async connectToServer() {
    try {
      this.transport = new SSEClientTransport(
        new URL("http://127.0.0.1:8000/sse")
      )
      await this.mcp.connect(this.transport)

      const toolsResult = await this.mcp.listTools()
      logger.debug(toolsResult)
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        }
      })
      logger.info(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      )
    } catch (e) {
      logger.info("Failed to connect to MCP server: ", e)
      throw e
    }
  }

  async run() {
    const input = await this.rl.question("Enter prompt: ")
    if (input == "quit") {
      this.rl.close()
      process.exit(0)
    }
    // this.previousMessages = await geminiQuery(
    //   input,
    //   this.tools,
    //   this.mcp,
    //   this.previousMessages
    // )
    this.previousMessages = await claudeQuery(
      input,
      this.tools,
      this.mcp,
      this.previousMessages as MessageParam[]
    )
    this.run()
  }
}

const client = new MCPClient()
await client.connectToServer()
await client.run()
