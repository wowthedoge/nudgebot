import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db.js";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const model = "claude-3-5-haiku-20241022";
const defaultMaxTokens = 150;
const commonPrompt =
  "You are a productivity coach WhatsApp bot who helps people stay on track with their goals who replies in a casual, conversational manner fit for WhatsApp texts.";

function getScheduleMessageTool(timezone = "UTC") {
  const now = new Date();
  const userTime = now.toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  console.log("getScheduleMessageTool current time", userTime);

  return {
    name: "scheduleMessage",
    description: `Schedule a message to be sent to the user at a specific time in the future. 

Current time in user's timezone: ${userTime}

IMPORTANT: 
- Always provide the scheduledAt in UTC format (ending with 'Z'). Convert from user's local time to UTC.
- When confirming to the user, ALWAYS show the scheduled time in the user's local timezone (${timezone}), not UTC.

Examples:
- If user says "5 minutes from now": calculate 5 minutes from current time, convert to UTC for storage, but tell user "I've scheduled this for [local time]"
- If user says "tomorrow at 8am": calculate tomorrow 8am in user's timezone, convert to UTC for storage, but confirm "I've scheduled this for tomorrow at 8am [user's timezone]"

Use this to schedule check-ins on the user for their goals.`,
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The message content to send to the user",
        },
        scheduledAt: {
          type: "string",
          description: "REQUIRED: ISO 8601 UTC datetime string ending with 'Z' (e.g., '2025-09-30T13:03:00Z'). Convert from user's local time to UTC.",
        },
      },
      required: ["content", "scheduledAt"],
    },
  };
}

export async function generateReply(userText, context, userId, timezone) {
  const prompt = `${commonPrompt} You have access to the user's conversation history and summary to provide personalized advice.

  ${context ? `User's context:\n${context}` : ""}`;

  try {
    const message = await client.messages.create({
      model: model,
      max_tokens: defaultMaxTokens,
      system: prompt,
      messages: [{ role: "user", content: userText }],
      tools: [getScheduleMessageTool(timezone)],
    });

    // Handle tool use
    if (message.content.some((content) => content.type === "tool_use")) {
      let response = "";

      for (const content of message.content) {
        if (content.type === "text") {
          response += content.text;
        } else if (
          content.type === "tool_use" &&
          content.name === "scheduleMessage"
        ) {
          const { content: messageContent, scheduledAt } = content.input;

          console.log("Received tool use", messageContent, scheduledAt, userId);

          // Call the actual scheduleMessage function
          await scheduleMessage(messageContent, scheduledAt, userId);

          // Add confirmation to response - show in user's timezone
          const scheduledDate = new Date(scheduledAt).toLocaleString('en-US', {
            timeZone: timezone, // Use the user's timezone for display
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          });
          response += `\n\n✅ I've scheduled a message for ${scheduledDate}`;
        }
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
  const prompt = `${commonPrompt} You might have access to the user's conversation history and summary to create a new summary of the conversation.

  ${previousSummary ? `Previous summary: ${previousSummary}` : ""}
  
  The summary should include the details of the user's goals. Don't leave anything out. Reply with only the summary and nothing else.`;

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

function scheduleMessage(content, scheduledAt, userId) {
  console.log("Scheduling message:", content, scheduledAt, userId);
  return db.saveScheduledMessage(content, scheduledAt, userId);
}
