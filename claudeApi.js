import axios from "axios";

export async function generateReply(userText, context, options = {}) {
  const {
    model = "claude-3-5-haiku-20241022",
    maxTokens = 300,
    systemPrompt = "You are a productivity coach who helps people stay on track with their goals.",
  } = options;

  try {
    const claudeResp = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model,
        max_tokens: maxTokens,
        system: `${systemPrompt} You have access to the user's conversation history and summary to provide personalized advice.
  
  ${context ? `User's context:\n${context}` : ""}
  
  Respond as a helpful productivity coach who remembers previous conversations.`,
        messages: [{ role: "user", content: userText }],
      },
      {
        headers: {
          "x-api-key": process.env.CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );

    return claudeResp.data.content[0].text;
  } catch (error) {
    console.error(
      "❌ Claude API error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to get message response from Claude API");
  }
}

export async function createSummary(messages, previousSummary) {
  const {
    model = "claude-3-5-haiku-20241022",
    maxTokens = 500,
    systemPrompt = `You are a productivity coach who helps people stay on track with their goals. You are given a list of messages and the previous summary and you need to create a new summary of the conversation. Remember to include the details of each of the user's goals.

    ${previousSummary ? `Previous summary: ${previousSummary}` : ""}
    `,
  } = options;

  try {
    const claudeResp = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
          },
        ],
      },
      {
        headers: {
          "x-api-key": process.env.CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );

    return claudeResp.data.content[0].text;
  } catch (error) {
    console.error(
      "❌ Claude API error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to get summary response from Claude API");
  }
}
