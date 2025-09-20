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

// Function to send WhatsApp message
async function sendWhatsAppMessage(phoneNumber, messageContent) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phoneNumber,
        text: { body: messageContent },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`📤 Sent scheduled message to ${phoneNumber}: ${messageContent}`);
  } catch (error) {
    console.error(`❌ Failed to send scheduled message to ${phoneNumber}:`, error.response?.data || error.message);
    throw error;
  }
}

// Function to process scheduled messages
async function processScheduledMessages() {
  try {
    console.log("🔍 Checking for scheduled messages...");
    const pendingMessages = await db.getPendingScheduledMessages();
    
    if (pendingMessages.length === 0) {
      console.log("📭 No scheduled messages to send");
      return;
    }

    console.log(`📬 Found ${pendingMessages.length} scheduled message(s) to send`);

    for (const scheduledMessage of pendingMessages) {
      try {
        // Send the message via WhatsApp
        await sendWhatsAppMessage(scheduledMessage.user.phoneNumber, scheduledMessage.content);
        
        // Mark as sent in database
        await db.markScheduledMessageAsSent(scheduledMessage.id);
        
        // Save the message to conversation history
        await db.saveMessage(scheduledMessage.userId, "assistant", scheduledMessage.content);
        
        console.log(`✅ Successfully sent scheduled message ID: ${scheduledMessage.id}`);
      } catch (error) {
        console.error(`❌ Failed to process scheduled message ID: ${scheduledMessage.id}`, error);
        // Continue with other messages even if one fails
      }
    }
  } catch (error) {
    console.error("❌ Error processing scheduled messages:", error);
  }
}

const SCHEDULED_MESSAGE_INTERVAL = process.env.SCHEDULED_MESSAGE_INTERVAL_MINUTES || 5 * 60 * 1000;
setInterval(processScheduledMessages, SCHEDULED_MESSAGE_INTERVAL);

// Run once on startup to catch any messages that should have been sent while the server was down
processScheduledMessages();

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
      const reply = await claudeApi.generateReply(userText, context, user.id);
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
      await sendWhatsAppMessage(userPhoneNumber, reply);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 WhatsApp Claude bot running...");
  console.log(`⏰ Scheduled message checker running every ${SCHEDULED_MESSAGE_INTERVAL / 60000} minutes`);
});
