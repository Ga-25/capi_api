// server.js (ESM)
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(cors()); // permite chamadas do front (em produção restrinja o origin)
app.use(express.json());

const PIXEL_ID = process.env.PIXEL_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const API_VERSION = process.env.API_VERSION || "v19.0";
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE || null;

function sha256(value = "") {
  return crypto.createHash("sha256").update(value).digest("hex");
}

app.post("/event", async (req, res) => {
  try {
    const { event_name, event_id, event_source_url, user = {}, custom_data = {} } = req.body;

    // montar user_data
    const user_data = {};
    if (user.email) user_data.em = [sha256(user.email.trim().toLowerCase())];
    if (user.phone) user_data.ph = [sha256((user.phone || "").replace(/\D/g, ""))];
    if (user.name)  user_data.fn = [sha256(user.name.trim().toLowerCase())];

    // fbp / fbc devem ser enviados sem hash (se existirem)
    if (user.fbp) user_data.fbp = user.fbp;
    if (user.fbc) user_data.fbc = user.fbc;

    // client info do request (vindo do servidor)
    user_data.client_user_agent = req.headers["user-agent"] || "";
    user_data.client_ip_address = req.headers["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.socket.remoteAddress;

    const payload = {
      data: [
        {
          event_name: event_name || "CustomEvent",
          event_time: Math.floor(Date.now() / 1000),
          event_id: event_id || `srv_${Date.now()}`,
          event_source_url: event_source_url || "",
          action_source: "website",
          user_data,
          custom_data
        }
      ]
    };

    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    const resp = await fetch(`https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await resp.json();
    return res.json({ ok: true, meta: json });
  } catch (err) {
    console.error("Erro CAPI:", err);
    res.status(500).json({ error: "Erro ao enviar evento para CAPI", details: err.message });
  }
});

app.get("/", (req, res) => res.send("CAPI running"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API rodando na porta ${PORT}`));
