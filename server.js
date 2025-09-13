import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(express.json());

// 🔑 SEUS DADOS DO PIXEL
const PIXEL_ID = "1109960830695523";
const ACCESS_TOKEN = "EAARMPjZBHlkMBPRSZBdbi3cetYj01eOGfUEFfducdSRBrB8txexmCO1rYUdoz6yBZC7SlR9xq6fnMxEIPrvZCQMAb3eD9zWMukaI6ZAmEJpsZA5oCFYrJKIqGtctKwAceFhFT5cAJkeEZCG3dpGKTyXUFxQwctrZBBa4hapLFf30TNR1wE2OKzsrXrX7iw7BNFLptwZDZD";

// Função utilitária → hash exigido pelo Facebook
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// Endpoint principal
app.post("/event", async (req, res) => {
  try {
    const { event_name, event_id, event_source_url, user_data, custom_data } = req.body;

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
      ],
      test_event_code: "TEST8669" // ⚠️ Só para teste
    };

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
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
