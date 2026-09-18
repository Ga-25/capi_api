// server.js
// StreamForce - Meta Conversions API

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import crypto from "crypto";


const app = express();

app.set("trust proxy", 1);


/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: [
      "https://www.acesstream.com.br",
      "https://acesstream.com.br"
    ],

    methods: [
      "GET",
      "POST",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type"
    ]
  })
);


app.use(
  express.json({
    limit: "100kb",
    strict: true
  })
);


/* =========================================================
   CONFIG
========================================================= */

const PIXEL_ID =
  process.env.PIXEL_ID;

const ACCESS_TOKEN =
  process.env.ACCESS_TOKEN;


/*
  IMPORTANTE:

  mantenha a versão que você configurar
  nas variáveis do Render.

  Se estiver usando atualmente v22.0,
  deixe v22.0 até confirmarmos a versão
  suportada pela Meta no seu ambiente.
*/

const API_VERSION =
  process.env.API_VERSION || "v22.0";


const TEST_EVENT_CODE =
  process.env.TEST_EVENT_CODE || null;


const ALLOWED_EVENTS =
  new Set([
    "InitiateCheckout",
    "CompleteRegistration",
    "Purchase"
  ]);


/* =========================================================
   VALIDAÇÃO DAS VARIÁVEIS
========================================================= */

if (!PIXEL_ID) {

  console.error(
    "PIXEL_ID não configurado."
  );

}


if (!ACCESS_TOKEN) {

  console.error(
    "ACCESS_TOKEN não configurado."
  );

}


/* =========================================================
   SHA256
========================================================= */

function sha256(value = "") {

  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");

}


/* =========================================================
   EMAIL
========================================================= */

function normalizeEmail(email = "") {

  return String(email)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

}


/* =========================================================
   TELEFONE BRASIL
========================================================= */

function normalizePhone(phone = "") {

  let digits =
    String(phone)
      .replace(/\D/g, "");


  /*
    Remove zeros que eventualmente
    tenham sido colocados no começo.
  */

  digits =
    digits.replace(/^0+/, "");


  /*
    Se veio DDD + número sem 55.
  */

  if (
    digits.length === 10 ||
    digits.length === 11
  ) {

    digits = "55" + digits;

  }


  return digits;

}


/* =========================================================
   NOME
========================================================= */

function normalizeName(name = "") {

  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

}


/* =========================================================
   IP
========================================================= */

function getClientIp(req) {

  const forwarded =
    req.headers["x-forwarded-for"];

  if (forwarded) {

    return forwarded
      .split(",")[0]
      .trim();

  }


  return (
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    ""
  );

}


/* =========================================================
   ENVIO META
========================================================= */

async function sendToMeta(payload) {

  if (!PIXEL_ID) {

    throw new Error(
      "PIXEL_ID não configurado."
    );

  }


  if (!ACCESS_TOKEN) {

    throw new Error(
      "ACCESS_TOKEN não configurado."
    );

  }


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => controller.abort(),
      10000
    );


  try {

    const url =
      `https://graph.facebook.com/` +
      `${API_VERSION}/` +
      `${PIXEL_ID}/events` +
      `?access_token=` +
      `${encodeURIComponent(
        ACCESS_TOKEN
      )}`;


    const response =
      await fetch(
        url,
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload),

          signal:
            controller.signal

        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        `Meta HTTP ${response.status}: ` +
        `${JSON.stringify(result)}`
      );

    }


    return result;


  } finally {

    clearTimeout(timeout);

  }

}


/* =========================================================
   /EVENT
========================================================= */

app.post(
  "/event",
  async (req, res) => {

    try {

      const {

        event_name,

        event_id,

        event_source_url = "",

        event_time,

        user = {},

        custom_data = {}

      } = req.body;


      /* -----------------------------------------
         EVENTO
      ----------------------------------------- */

      if (
        !event_name ||
        !ALLOWED_EVENTS.has(
          event_name
        )
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              "Evento não permitido."
          });

      }


      /* -----------------------------------------
         EVENT ID
      ----------------------------------------- */

      if (!event_id) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              "event_id é obrigatório."
          });

      }


      /* -----------------------------------------
         PURCHASE
      ----------------------------------------- */

      if (
        event_name === "Purchase"
      ) {

        const value =
          Number(
            custom_data.value
          );


        if (
          !Number.isFinite(value) ||
          value <= 0
        ) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                "Valor do Purchase inválido."
            });

        }


        if (
          custom_data.currency !==
          "BRL"
        ) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                "Currency do Purchase deve ser BRL."
            });

        }

      }


      /* -----------------------------------------
         USER DATA
      ----------------------------------------- */

      const user_data = {};


      /*
        EMAIL
      */

      if (user.email) {

        const email =
          normalizeEmail(
            user.email
          );


        if (email) {

          user_data.em =
            sha256(email);

        }

      }


      /*
        TELEFONE
      */

      if (user.phone) {

        const phone =
          normalizePhone(
            user.phone
          );


        if (
          phone.length >= 12 &&
          phone.length <= 13
        ) {

          user_data.ph =
            sha256(phone);

        }

      }


      /*
        NOME
      */

      if (user.name) {

        const name =
          normalizeName(
            user.name
          );


        const parts =
          name
            .split(" ")
            .filter(Boolean);


        if (parts.length >= 1) {

          user_data.fn =
            sha256(
              parts[0]
            );

        }


        if (parts.length >= 2) {

          user_data.ln =
            sha256(
              parts
                .slice(1)
                .join(" ")
            );

        }

      }


      /*
        FBP

        NÃO fazer hash.
      */

      if (user.fbp) {

        user_data.fbp =
          String(
            user.fbp
          ).trim();

      }


      /*
        FBC

        NÃO fazer hash.
      */

      if (user.fbc) {

        user_data.fbc =
          String(
            user.fbc
          ).trim();

      }


      /*
        USER AGENT
      */

      user_data.client_user_agent =
        req.headers[
          "user-agent"
        ] || "";


      /*
        IP
      */

      const clientIp =
        getClientIp(req);


      if (clientIp) {

        user_data.client_ip_address =
          clientIp;

      }


      /* -----------------------------------------
         EVENT PAYLOAD
      ----------------------------------------- */

      const eventPayload = {

        data: [

          {

            event_name,

            event_time:
              Number.isFinite(
                Number(event_time)
              )
                ? Number(event_time)
                : Math.floor(
                    Date.now() / 1000
                  ),

            event_id,

            event_source_url,

            action_source:
              "website",

            user_data,

            custom_data

          }

        ]

      };


      /* -----------------------------------------
         TEST EVENT CODE
      ----------------------------------------- */

      if (TEST_EVENT_CODE) {

        eventPayload.test_event_code =
          TEST_EVENT_CODE;

      }


      /* -----------------------------------------
         META
      ----------------------------------------- */

      const metaResponse =
        await sendToMeta(
          eventPayload
        );


      console.log(
        `CAPI ${event_name} enviado`,
        {
          event_id,
          events_received:
            metaResponse.events_received || 0
        }
      );


      return res.json({

        ok: true,

        event_name,

        event_id,

        events_received:
          metaResponse.events_received ||
          0,

        fbtrace_id:
          metaResponse.fbtrace_id ||
          null

      });


    } catch (error) {

      console.error(
        "Erro Meta CAPI:",
        error
      );


      return res
        .status(500)
        .json({

          ok: false,

          error:
            "Erro ao enviar evento para Meta CAPI.",

          details:
            error.message

        });

    }

  }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  (req, res) => {

    res.json({

      status:
        "healthy",

      pixel_configured:
        Boolean(PIXEL_ID),

      token_configured:
        Boolean(ACCESS_TOKEN),

      api_version:
        API_VERSION,

      test_mode:
        Boolean(
          TEST_EVENT_CODE
        ),

      timestamp:
        new Date().toISOString()

    });

  }
);


/* =========================================================
   ROOT
========================================================= */

app.get(
  "/",
  (req, res) => {

    res.send(
      "StreamForce CAPI running"
    );

  }
);


/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {

    res
      .status(404)
      .json({

        ok: false,

        error:
          "Endpoint não encontrado."

      });

  }
);


/* =========================================================
   SERVER
========================================================= */

const PORT =
  process.env.PORT || 3000;


app.listen(
  PORT,
  () => {

    console.log(
      `🚀 StreamForce CAPI rodando na porta ${PORT}`
    );

    console.log(
      `📡 Pixel: ${
        PIXEL_ID
          ? "configurado"
          : "NÃO configurado"
      }`
    );

    console.log(
      `🔐 Token: ${
        ACCESS_TOKEN
          ? "configurado"
          : "NÃO configurado"
      }`
    );

    console.log(
      `⚡ API: ${API_VERSION}`
    );

  }
);


export default app;