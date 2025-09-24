// server.js (ESM) - pronto para Render
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();

// Domínios OK (adicione aqui outras variações se necessário)
const allowedOrigins = [
  'https://www.acesstream.com.br',
  'https://acesstream.com.br'
];

const corsOptions = {
  origin: function(origin, callback){
    if (!origin) return callback(null, true); // permite ferramentas sem origin
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS - origin not allowed'));
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// variáveis (defina no Render)
const PIXEL_ID = process.env.PIXEL_ID;                      // primary
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;              // primary token
const BACKUP_PIXEL_ID = process.env.BACKUP_PIXEL_ID || "";  // opcional
const BACKUP_ACCESS_TOKEN = process.env.BACKUP_ACCESS_TOKEN || ""; // opcional
const API_VERSION = process.env.API_VERSION || "v19.0";
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE || null; // opcional

function sha256(value = "") {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

async function sendToPixel(pixelId, token, payload) {
  if (!pixelId || !token) return { skipped: true, reason: "missing_pixel_or_token" };
  const url = `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${token}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeout: 15000
    });
    const json = await resp.json();
    console.log(`📡 Pixel ${pixelId} resposta:`, JSON.stringify(json));
    return json;
  } catch (err) {
    console.error('❌ Erro sendToPixel:', err);
    return { error: String(err) };
  }
}

app.post("/event", async (req, res) => {
  try {
    const {
      event_name = "CustomEvent",
      event_id,
      event_source_url = "",
      user = {},
      custom_data = {}
    } = req.body;

    if (!event_name || !event_name.trim()) {
      return res.status(400).json({ error: "event_name é obrigatório" });
    }

    // NÃO envie PageView do servidor por padrão
    if (event_name && event_name.toLowerCase() === "pageview") {
      return res.json({ ok: true, skipped: "server_pageview_skipped" });
    }

    // montar user_data com hash (conforme exigência do Meta)
    const user_data = {};
    if (user.email) user_data.em = [ sha256(String(user.email).trim().toLowerCase()) ];
    if (user.phone) user_data.ph = [ sha256(String(user.phone).replace(/\D/g, "")) ];
    if (user.name) user_data.fn = [ sha256(String(user.name).trim().toLowerCase()) ];
    if (user.fbp) user_data.fbp = user.fbp;
    if (user.fbc) user_data.fbc = user.fbc;

    user_data.client_user_agent = req.headers["user-agent"] || "";
    user_data.client_ip_address = req.headers["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.socket.remoteAddress;

    // garante um event_id único se não vier
    // use sempre o event_id vindo do client
const finalEventId = event_id;
if (!finalEventId) {
  console.warn("⚠️ Evento recebido sem event_id — risco de deduplicação incorreta");
}

    const payload = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: finalEventId,
          event_source_url: event_source_url || (req.headers.origin || allowedOrigins[0]),
          action_source: "website",
          user_data,
          custom_data
        }
      ]
    };

    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    // log útil antes de enviar
    console.log("📤 Enviando evento:", {
      event_name,
      event_id: finalEventId,
      pixel_primary: PIXEL_ID,
      user_data_keys: Object.keys(user_data),
      timestamp: new Date().toISOString(),
      origin: req.headers.origin || 'no-origin'
    });

    // envia para pixel primário
    const primaryResp = await sendToPixel(PIXEL_ID, ACCESS_TOKEN, payload);

    // envia para pixel backup (opcional)
    let backupResp = null;
    if (BACKUP_PIXEL_ID && BACKUP_ACCESS_TOKEN) {
      backupResp = await sendToPixel(BACKUP_PIXEL_ID, BACKUP_ACCESS_TOKEN, payload);
    }

    // define CORS na resposta (normalmente o cors() já faz isso)
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // resposta para debug
    return res.json({ ok: true, primary: primaryResp, backup: backupResp });
  } catch (err) {
    console.error("Erro CAPI:", err);
    return res.status(500).json({ error: "Erro ao enviar evento para CAPI", details: String(err) });
  }
});

app.get("/", (req, res) => res.send("CAPI running"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API rodando na porta ${PORT}`));