import { Tool } from "@anthropic-ai/sdk/resources/messages.mjs"
import {
  Content,
  FunctionDeclaration,
  GoogleGenAI,
  Schema,
} from "@google/genai"
import { Logger } from "./logger"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"

const logger = new Logger()
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY })

export async function geminiQuery(input: string, tools: Tool[], mcp: Client) {
  const messages: Content[] = [{ role: "user", parts: [{ text: input }] }]
  return processQuery(messages, tools, mcp)
}

async function processQuery(messages: Content[], tools: Tool[], mcp: Client) {
  const content = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: messages,
    config: {
      tools: [
        {
          functionDeclarations: tools.map<FunctionDeclaration>((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: toGoogleSchema(tool.input_schema),
          })),
        },
      ],
    },
  })
  if (!content.functionCalls) {
    logger.info(content.text)
    return
  }

  logger.debug(JSON.stringify(content))
  for (const functionCall of content.functionCalls) {
    logger.debug(
      `Call tool ${functionCall.name} with ${JSON.stringify(functionCall.args)}`
    )
    const result = await mcp.callTool({
      name: functionCall.name || "",
      arguments: functionCall.args,
    })
    logger.debug(`Get response with content: ${JSON.stringify(result.content)}`)
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
    return processQuery(messages, tools, mcp)
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
