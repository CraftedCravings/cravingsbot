import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import menu from "./menu.json" assert { type: "json" };

dotenv.config();

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ---------- Helper to send WhatsApp message ----------
async function sendMessage(payload) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// ---------- Webhook verification ----------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------- Incoming messages ----------
app.post("/webhook", async (req, res) => {
  const message =
    req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message) return res.sendStatus(200);

  const from = message.from;

  // ================= MENU COMMAND =================
  if (message.text?.body?.toLowerCase() === "menu") {
    await sendMessage({
      messaging_product: "whatsapp",
      to: from,
      type: "interactive",
      interactive: {
        type: "list",
        body: {
          text: "🍽️ *Crafted Cravings Menu*\nPlease choose a category:"
        },
        action: {
          button: "Select Category",
          sections: [
            {
              title: "Categories",
              rows: [
                { id: "cat_cold_coffee", title: "Cold Coffee" },
                { id: "cat_shakes", title: "Shakes" },
                { id: "cat_pizza", title: "Pizza" },
                { id: "cat_maggie", title: "Maggie" },
                { id: "cat_ice_tea", title: "Ice Tea" },
                { id: "cat_hot_beverages", title: "Hot Beverages" },
                { id: "cat_sandwiches", title: "Sandwiches" }
              ]
            }
          ]
        }
      }
    });

    return res.sendStatus(200);
  }

  // ================= CATEGORY SELECTED =================
  if (message.interactive?.list_reply?.id?.startsWith("cat_")) {
    const categoryKey = message.interactive.list_reply.id.replace("cat_", "");
    const items = menu[categoryKey];

    if (!items) return res.sendStatus(200);

    await sendMessage({
      messaging_product: "whatsapp",
      to: from,
      type: "interactive",
      interactive: {
        type: "list",
        body: {
          text: `Select an item from *${categoryKey.replace("_", " ")}*`
        },
        action: {
          button: "Select Item",
          sections: [
            {
              title: "Items",
              rows: items.map(item => ({
                id: `item_${item.id}`,
                title: item.name,
                description: `₹${item.price}`
              }))
            }
          ]
        }
      }
    });

    return res.sendStatus(200);
  }

  // ================= ITEM SELECTED =================
  if (message.interactive?.list_reply?.id?.startsWith("item_")) {
    const itemId = parseInt(
      message.interactive.list_reply.id.replace("item_", "")
    );

    let selectedItem;
    for (const category in menu) {
      selectedItem = menu[category].find(i => i.id === itemId);
      if (selectedItem) break;
    }

    if (!selectedItem) return res.sendStatus(200);

    await sendMessage({
      messaging_product: "whatsapp",
      to: from,
      text: {
        body: `✅ *${selectedItem.name}* added!\n\nReply:\n1️⃣ Add more items\n2️⃣ Checkout`
      }
    });

    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

// ---------- Start server ----------
app.listen(3000, () => {
  console.log("Crafted Cravings bot running on port 3000");
});
