import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db.js";
import { prompts, tools } from "./promptsAndTools.js";
import {  getUtcOffset } from "./timezones.js";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const model = "claude-3-5-haiku-20241022";
const defaultMaxTokens = 150;

export async function generateReply(userText, context, userId, userTimezone, retryCount = 0) {
  const MAX_RETRIES = 2;
  const prompt = prompts.generateReply(context);

  try {
    const message = await client.messages.create({
      model: model,
      max_tokens: defaultMaxTokens,
      system: prompt,
      messages: [{ role: "user", content: userText }],
      tools: [tools.getScheduleMessageTool()],
    });

    // Handle tool use
    if (message.content.some((content) => content.type === "tool_use")) {
      let response = "";
      let hasInvalidToolCall = false;

      for (const content of message.content) {
        if (content.type === "text") {
          response += content.text;
        } else if (
          content.type === "tool_use" &&
          content.name === "scheduleMessage"
        ) {
          const { content: messageContent, scheduledAt } = content.input;
          
          if (!scheduledAt || scheduledAt === "undefined") {
            console.error("⚠️ scheduledAt is undefined or invalid:", { messageContent, scheduledAt });
            hasInvalidToolCall = true;
            
            if (retryCount < MAX_RETRIES) {
              return generateReply(userText, context, userId, userTimezone, retryCount + 1);
            } else {
              console.error("❌ Max retries reached. scheduledAt still undefined.");
              return "I'm having trouble scheduling that right now. Could you try asking again later?";
            }
          }
          
          await scheduleMessage(messageContent, scheduledAt, userId, userTimezone);
        }
      }

      if (hasInvalidToolCall) {
        return;
      }

      return response.trim();
    }

    // Return regular text response if no tools were used
    return message.content[0].text;
  } catch (error) {
    console.error("❌ Claude API error:", error.message);
    throw new Error("Failed to get message response from Claude API");
  }
}

export async function createSummary(messages, previousSummary) {
  const prompt = prompts.createSummary(messages, previousSummary);

  try {
    const message = await client.messages.create({
      model: model,
      max_tokens: 600,
      system: prompt,
      messages: [
        {
          role: "user",
          content: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
        },
      ],
    });

    return message.content[0].text;
  } catch (error) {
    console.error("❌ Claude API error:", error.message);
    throw new Error("Failed to get summary response from Claude API");
  }
}

function scheduleMessage(content, scheduledAt, userId, userTimezone) {
  const offset = getUtcOffset(userTimezone, new Date(scheduledAt));
  const adjustedTime = new Date(new Date(scheduledAt).getTime() - offset * 60 * 60 * 1000);
  console.log(
    "Scheduling message. | Content:",
    content,
    "| Scheduled at (UTC):",
    scheduledAt,
    "| Offset:",
    offset,
    "| Adjusted to (User local):",
    adjustedTime.toISOString(),
    "| User ID:",
    userId
  );
  return db.saveScheduledMessage(content, adjustedTime, userId);
}
