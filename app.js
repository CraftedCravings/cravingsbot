import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { CATALOG_ID, GROUPS } from "./catalogConfig.js";

dotenv.config();

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ===========================
// SEND WHATSAPP MESSAGE
// ===========================
async function sendWhatsapp(payload) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("WhatsApp API Error:", err.response?.data || err.message);
  }
}

// ===========================
// WEBHOOK VERIFICATION (GET)
// ===========================
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  return res.sendStatus(403);
});

// ===========================
// WEBHOOK RECEIVE MESSAGE (POST)
// ===========================
app.post("/webhook", async (req, res) => {
  try {
    const msg =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    console.log("Incoming Webhook:", JSON.stringify(msg, null, 2));

    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body?.toLowerCase() || "";

    // ===========================
    // 1. USER SENDS "menu"
    // ===========================
    if (text.includes("menu")) {
      await sendWhatsapp({
        messaging_product: "whatsapp",
        to: from,
        type: "interactive",
        interactive: {
          type: "list",
          body: {
            text: "🍽 *Crafted Cravings Menu*\nPlease choose a category:",
          },
          action: {
            button: "Select Category",
            sections: [
              {
                title: "Menu Categories",
                rows: [
                  { id: "cat_pizza", title: "🍕 Pizza" },
                  { id: "cat_shakes", title: "🧋 Shakes" },
                  { id: "cat_cold_coffee", title: "☕ Cold Coffee" },
                ],
              },
            ],
          },
        },
      });

      return res.sendStatus(200);
    }

    // ===========================
    // 2. CATEGORY SELECTED
    // ===========================
    if (msg.interactive?.list_reply?.id?.startsWith("cat_")) {
      const categoryKey = msg.interactive.list_reply.id.replace("cat_", "");

      const groupId = GROUPS[categoryKey];

      if (!groupId) {
        await sendWhatsapp({
          messaging_product: "whatsapp",
          to: from,
          text: { body: "Sorry, that category is not available." },
        });
        return res.sendStatus(200);
      }

      await sendWhatsapp({
        messaging_product: "whatsapp",
        to: from,
        type: "interactive",
        interactive: {
          type: "product_list",
          header: {
            type: "text",
