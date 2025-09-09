import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ✅ Verify webhook
app.get("/webhook", (req, res) => {
  const verifyToken = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ✅ Handle WhatsApp messages
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message && message.text) {
      const from = message.from; // user's phone number
      const userText = message.text.body;

      console.log("📩 Received:", userText);

      // --- Call Claude API ---
      const claudeResp = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 300,
          system: "You are a productivity coach who helps people stay on track with their goals.",
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

      const replyText = claudeResp.data.content[0].text;
      console.log("🤖 Reply:", replyText);

      // --- Send back to WhatsApp ---
      await axios.post(
        `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: replyText },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 WhatsApp Claude bot running...");
});
