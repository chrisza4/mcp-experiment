import { Tool } from "@anthropic-ai/sdk/resources/messages.mjs"
import Anthropic from "@anthropic-ai/sdk"
import { Logger } from "./logger"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"

const logger = new Logger()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function claudeQuery(
  input: string,
  tools: Tool[],
  mcp: Client,
  previousMessages: Anthropic.Messages.MessageParam[]
): Promise<Anthropic.Messages.MessageParam[]> {
  const messages: Anthropic.Messages.MessageParam[] = [
    ...previousMessages,
    { role: "user", content: input },
  ]
  return processQuery(messages, tools, mcp)
}

async function processQuery(
  messages: Anthropic.Messages.MessageParam[],
  tools: Tool[],
  mcp: Client
): Promise<Anthropic.Messages.MessageParam[]> {
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    messages,
    tools: tools.length > 0 ? tools : undefined,
  })

  const lastMessage = response.content[response.content.length - 1]

  const returnMessages = [...messages]
  returnMessages.push({
    role: "assistant",
    content: response.content,
  })

  // Check if Claude wants to use a tool
  if (lastMessage.type === "tool_use") {
    logger.debug(
      `Call tool ${lastMessage.name} with ${JSON.stringify(lastMessage.input)}`
    )

    const result = await mcp.callTool({
      name: lastMessage.name,
      arguments: lastMessage.input as any,
    })

    logger.debug(`Get response with content: ${JSON.stringify(result.content)}`)

    // Add tool result to messages
    returnMessages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: lastMessage.id,
          content: JSON.stringify(result.content),
        },
      ],
    })

    return processQuery(returnMessages, tools, mcp)
  }

  const textContent = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")

  logger.info(textContent)
  return returnMessages
}
