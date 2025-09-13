import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(express.json());

// 🔑 Dados do Pixel via variáveis de ambiente
const PIXEL_ID = process.env.PIXEL_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const API_VERSION = process.env.API_VERSION || "v19.0";
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE; // opcional

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

app.post("/event", async (req, res) => {
  try {
    const { event_name, event_id, event_source_url, user, custom_data } = req.body;

    // montar user_data com hash
    const user_data = {};
    if (user?.email) user_data.em = sha256(user.email.trim().toLowerCase());
    if (user?.phone) user_data.ph = sha256(user.phone.replace(/\D/g, ""));
    if (user?.fbp) user_data.fbp = user.fbp;
    if (user?.fbc) user_data.fbc = user.fbc;

    user_data.client_user_agent = req.headers["user-agent"] || "";
    user_data.client_ip_address = req.headers["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.socket.remoteAddress;

    const payload = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id,
          event_source_url,
          action_source: "website",
          user_data,
          custom_data
        }
      ]
    };

    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      }
    );

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao enviar evento para CAPI" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API rodando na porta ${PORT}`));