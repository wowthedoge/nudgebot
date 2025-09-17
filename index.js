import express from "express";
import axios from "axios";
import * as db from "./db.js";
import * as claudeApi from "./claudeApi.js";

const app = express();
app.use(express.json());
const SAVE_MESSAGE_COUNT = 20;

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
      const userPhoneNumber = message.from;
      const userText = message.text.body;
      console.log("📩 Received:", userText);

      // --- Get memory ---
      const user = await db.getOrCreateUser(userPhoneNumber);
      const memory = await db.getMemory(user.id);

      // --- Build context ---
      let context = "";

      if (memory?.summary) {
        context += `Previous conversation summary: ${memory.summary.text}\n\n`;
      }

      if (memory?.messages?.length > 0) {
        context += `Recent conversation: ${memory.messages
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}\n\n`;
      }

      // --- Call Claude API ---
      const reply = await claudeApi.generateReply(userText, context);
      console.log("🤖 Reply:", reply);

      // --- Save message ---
      await db.saveMessage(user.id, "user", userText);
      const messageCount = await db.saveMessage(
        user.id,
        "assistant",
        reply
      );

      console.log("Saved messageCount", messageCount);

      // --- Save summary ---
      if (messageCount >= SAVE_MESSAGE_COUNT) {
        const newSummary = await claudeApi.createSummary(
          memory.messages,
          memory.summary?.text || ""
        );
        await db.updateSummary(user.id, newSummary);
        await db.deleteMessages(user.id);

        console.log("Saved summary", newSummary);
      }

      // --- Send back to WhatsApp ---
      await axios.post(
        `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: userPhoneNumber,
          text: { body: reply },
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
