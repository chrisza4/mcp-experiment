import { Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs"
import {
  Content,
  FunctionDeclaration,
  GoogleGenAI,
  Schema,
} from "@google/genai"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import readline from "readline/promises"
import dotenv from "dotenv"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"

dotenv.config()

function debugLog(...args: any[]) {
  if (!process.env.DEBUG) {
    return
  }
  console.log(...args)
}
class MCPClient {
  private mcp: Client
  private ai: GoogleGenAI
  private transport: Transport | null = null
  private tools: Tool[] = []
  private rl: readline.Interface

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY })
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" })
    this.rl = readline.createInterface(process.stdin, process.stdout)
  }
  // methods will go here
  async connectToServer() {
    try {
      this.transport = new SSEClientTransport(
        new URL("http://127.0.0.1:8000/sse")
      )
      await this.mcp.connect(this.transport)

      const toolsResult = await this.mcp.listTools()
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        }
      })
      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      )
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e)
      throw e
    }
  }

  async run() {
    const input = await this.rl.question("Enter prompt: ")
    if (input == "quit") {
      this.rl.close()
      process.exit(0)
    }
    await this.processQuery([{ role: "user", parts: [{ text: input }] }])
    this.run()
  }

  private async processQuery(messages: Content[]) {
    const content = await this.ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: messages,
      config: {
        tools: [
          {
            functionDeclarations: this.tools.map<FunctionDeclaration>(
              (tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: toGoogleSchema(tool.input_schema),
              })
            ),
          },
        ],
      },
    })
    if (content.functionCalls) {
      debugLog(JSON.stringify(content))
      for (const functionCall of content.functionCalls) {
        debugLog(
          `Call tool ${functionCall.name} with ${JSON.stringify(
            functionCall.args
          )}`
        )
        const result = await this.mcp.callTool({
          name: functionCall.name || "",
          arguments: functionCall.args,
        })
        debugLog(`Get response with content: ${JSON.stringify(result.content)}`)
        messages.push({
          parts: [
            {
              functionCall,
            },
          ],
        })
        messages.push({
          parts: [
            {
              functionResponse: {
                id: functionCall.id,
                name: functionCall.name,
                response: {
                  output: result.content,
                },
              },
            },
          ],
        })
        return this.processQuery(messages)
      }
    } else {
      console.log(content.text)
    }
  }
}

function toGoogleSchema(t: Tool.InputSchema): Schema {
  return Object.keys(t).reduce((acc, key) => {
    if (["additionalProperties", "$schema"].includes(key)) {
      return acc
    }
    acc[key] = t[key]
    return acc
  }, {}) as Schema
}

const client = new MCPClient()
await client.connectToServer()
await client.run()
