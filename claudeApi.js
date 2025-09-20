import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db.js";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const model = "claude-3-5-haiku-20241022";
const defaultMaxTokens = 150;
const commonPrompt =
  "You are a productivity coach WhatsApp bot who helps people stay on track with their goals who replies in a casual, conversational manner fit for WhatsApp texts.";

function getScheduleMessageTool() {
  console.log("getScheduleMessageTool current time", new Date().toLocaleString());
  return {
    name: "scheduleMessage",
    description: `Schedule a message to be sent to the user at a specific time in the future. Note: it is currently ${new Date().toLocaleString()} Use this to schedule check-ins on the user for their goals. For example, if the user's goal is to wake up at 5am, schedule a message at 5am to check in on them. Another example: If the user has a bad habit of using their phone too much at night, schedule messages at 10pm asking if they are using their phone.`,
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The message content to send to the user",
        },
        scheduledAt: {
          type: "string",
          description:
            "ISO 8601 datetime string for when to send the message (e.g., '2024-01-15T10:30:00Z')",
        },
      },
      required: ["content", "scheduledAt"],
    },
  };
}

export async function generateReply(userText, context, userId) {
  const prompt = `${commonPrompt} You have access to the user's conversation history and summary to provide personalized advice.

  ${context ? `User's context:\n${context}` : ""}`;

  try {
    const message = await client.messages.create({
      model: model,
      max_tokens: defaultMaxTokens,
      system: prompt,
      messages: [{ role: "user", content: userText }],
      tools: [getScheduleMessageTool()],
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

          // Add confirmation to response
          const scheduledDate = new Date(scheduledAt).toLocaleString();
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
