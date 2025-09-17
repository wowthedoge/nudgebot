import axios from "axios";

const model = "claude-3-5-haiku-20241022";
const defaultMaxTokens = 300;
const commonHeaders = {
  "x-api-key": process.env.CLAUDE_API_KEY,
  "anthropic-version": "2023-06-01",
  "Content-Type": "application/json",
};
const commonPrompt =
  "You are a productivity coach who helps people stay on track with their goals.";

export async function generateReply(userText, context) {
  const prompt = `${commonPrompt} You have access to the user's conversation history and summary to provide personalized advice.

  ${context ? `User's context:\n${context}` : ""}`;

  try {
    const claudeResp = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: model,
        max_tokens: defaultMaxTokens,
        system: prompt,
        messages: [{ role: "user", content: userText }],
      },
      {
        headers: commonHeaders,
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

  const prompt = `${commonPrompt} You might have access to the user's conversation history and summary to create a new summary of the conversation.

  ${previousSummary ? `Previous summary: ${previousSummary}` : ""}
  
  The summary should include the details of the user's goals. Don't leave anything out. Reply with only the summary and nothing else.`;

  try {
    const claudeResp = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: model,
        max_tokens: 600,
        system: prompt,
        messages: [
          {
            role: "user",
            content: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
          },
        ],
      },
      {
        headers: commonHeaders,
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
