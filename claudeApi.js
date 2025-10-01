import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db.js";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const model = "claude-3-5-haiku-20241022";
const defaultMaxTokens = 150;

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

  return toolDescriptions.scheduleMessage(timezone, userTime);
}

export async function generateReply(userText, context, userId, timezone) {
  const prompt = systemPrompts.generateReply(context);

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
            timeZone: timezone,
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          });
          response += confirmationMessages.scheduledMessage(scheduledDate);
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
  const prompt = systemPrompts.createSummary(previousSummary);

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


export const systemPrompts = {
  common: "You're like a caring friend who genuinely wants to see people succeed and feel their best. You're warm, encouraging, but not too eager - like you're texting a close buddy. You celebrate their wins, gently nudge them when they need it. You're curious about their goals, but you know it's up to them to take action.",

  generateReply: (context) => `${systemPrompts.common}

You know their story and what they're working toward, so you can give personalized advice that actually matters to them.

${context ? `Here's what you know about them:\n${context}` : ""}`,

  createSummary: (previousSummary) => `${systemPrompts.common}

${previousSummary ? `What you knew before:\n${previousSummary}` : ""}

Create a friendly summary of your conversation that captures their goals, challenges, and what matters to them. Write it like you're taking notes about a friend you care about - include the important stuff so you can be genuinely helpful next time. Just the summary, nothing else.`,
};

export const toolDescriptions = {
  scheduleMessage: (timezone, userTime) => ({
    name: "scheduleMessage",
    description: `Help your friend by scheduling a supportive message for later! 

Current time where they are: ${userTime}

When they ask for reminders or check-ins, set up a message that'll reach them at just the right moment. Think about what would actually be helpful and encouraging for them.

IMPORTANT: 
- Always provide the scheduledAt in UTC format (ending with 'Z'). Convert from their local time to UTC.
- When you confirm with them, show the time in their timezone (${timezone}) so it makes sense to them.

Examples:
- "remind me in 30 minutes" → calculate 30 min from now, store in UTC, but tell them "I'll check in with you at [their local time]"
- "wake me up at 7am tomorrow" → calculate 7am tomorrow in their timezone, store in UTC, confirm "I'll send you a wake-up message tomorrow at 7am"

You're helping them stay on track with their goals, so make it personal and caring!`,
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "A friendly, encouraging message that will help them with their goals",
        },
        scheduledAt: {
          type: "string",
          description:
            "REQUIRED: ISO 8601 UTC datetime string ending with 'Z' (e.g., '2025-09-30T13:03:00Z'). Convert from their local time to UTC.",
        },
      },
      required: ["content", "scheduledAt"],
    },
  }),
};

export const confirmationMessages = {
  scheduledMessage: (scheduledDate) => `\n\n✅ Got it! I'll send you a friendly reminder on ${scheduledDate}`,
};
