import { Tool } from "@anthropic-ai/sdk/resources/messages.mjs"
import {
  Content,
  FunctionDeclaration,
  GenerateContentResponse,
  GoogleGenAI,
  Schema,
} from "@google/genai"
import { Logger } from "./logger"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"

const logger = new Logger()
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY })

export async function geminiQuery(
  input: string,
  tools: Tool[],
  mcp: Client,
  previousMessages: Content[]
): Promise<Content[]> {
  const message: Content = { role: "user", parts: [{ text: input }] }
  const messages = [...previousMessages, message]
  return processQuery(messages, tools, mcp)
}

function addModelResponseToContent(
  messages: Content[],
  content: GenerateContentResponse
): Content[] {
  if (content.candidates && content.candidates[0].content) {
    return [...messages, content.candidates[0].content]
  }
  return messages
}

async function processQuery(
  messages: Content[],
  tools: Tool[],
  mcp: Client
): Promise<Content[]> {
  const content = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-05-20",
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

  const newMessages = addModelResponseToContent(messages, content)

  logger.debug(JSON.stringify(content))
  if (!content.functionCalls) {
    logger.info("From Gemini: ", content.text)
    return newMessages
  }
  for (const functionCall of content.functionCalls) {
    logger.debug(
      `Call tool ${functionCall.name} with ${JSON.stringify(functionCall.args)}`
    )
    const result = await mcp.callTool({
      name: functionCall.name || "",
      arguments: functionCall.args,
    })
    logger.debug(`Get response with content: ${JSON.stringify(result.content)}`)
    newMessages.push({
      role: "user",
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
  }
  return processQuery(newMessages, tools, mcp)
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
