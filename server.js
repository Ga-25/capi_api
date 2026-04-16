// server.js (ESM) - FURION POWER CAPI
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import crypto from "crypto";



const app = express();



// FURION POWER - Enhanced CORS
app.use(cors({
  origin: [
    'https://acesstream.com.br',
    'https://www.acesstream.com.br'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));



app.use(express.json({ limit: '10mb' }));



// FURION POWER - Environment Variables
const PIXEL_ID = process.env.PIXEL_ID || '1265874438298153'; // seu pixel
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // obrigatório



const API_VERSION = process.env.API_VERSION || "v19.0";
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE || null;



// ✅ FURION POWER - SHA256 MELHORADO
function sha256(value = "") {
    if (!value || typeof value !== 'string') return '';
    try {
        // Normalização avançada
        const normalizedValue = String(value)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ') // Múltiplos espaços → espaço único
            .replace(/\s+$/, ''); // Remove espaços finais
            
        return crypto.createHash("sha256")
            .update(normalizedValue)
            .digest("hex");
    } catch (error) {
        console.error('SHA256 Error:', error);
        return '';
    }
}


// ✅ FURION POWER - FUNÇÕES DE ENRICHMENT AVANÇADO



function detectPhoneRegion(areaCode) {
    const regionMap = {
        '11': 'SP_Capital', '12': 'SP_Interior', '13': 'SP_Litoral', '14': 'SP_Interior',
        '15': 'SP_Interior', '16': 'SP_Interior', '17': 'SP_Interior', '18': 'SP_Interior', '19': 'SP_Interior',
        '21': 'RJ_Capital', '22': 'RJ_Interior', '24': 'RJ_Interior',
        '27': 'ES', '28': 'ES',
        '31': 'MG_Capital', '32': 'MG_Interior', '33': 'MG_Interior', '34': 'MG_Interior', '35': 'MG_Interior', '37': 'MG_Interior', '38': 'MG_Interior',
        '41': 'PR_Capital', '42': 'PR_Interior', '43': 'PR_Interior', '44': 'PR_Interior', '45': 'PR_Interior', '46': 'PR_Interior',
        '47': 'SC_Norte', '48': 'SC_Capital', '49': 'SC_Oeste',
        '51': 'RS_Capital', '53': 'RS_Interior', '54': 'RS_Interior', '55': 'RS_Interior',
        '61': 'DF', '62': 'GO', '64': 'GO',
        '65': 'MT', '66': 'MT', '67': 'MS',
        '68': 'AC', '69': 'RO',
        '71': 'BA_Capital', '73': 'BA_Interior', '74': 'BA_Interior', '75': 'BA_Interior', '77': 'BA_Interior',
        '79': 'SE', '81': 'PE_Capital', '87': 'PE_Interior',
        '82': 'AL', '83': 'PB', '84': 'RN', '85': 'CE', '86': 'PI', '87': 'PE', '88': 'CE', '89': 'PI',
        '91': 'PA_Capital', '93': 'PA_Interior', '94': 'PA_Interior',
        '95': 'RR', '96': 'AP', '97': 'AM', '98': 'MA', '99': 'MA'
    };
    return regionMap[areaCode] || 'Unknown';
}



function analyzeUserAgent(userAgent) {
    const ua = userAgent.toLowerCase();
    
    // Device Type
    let device_type = 'desktop';
    if (/mobile|android|iphone|ipad|tablet/.test(ua)) {
        device_type = /ipad|tablet/.test(ua) ? 'tablet' : 'mobile';
    }
    
    // Browser
    let browser = 'unknown';
    if (ua.includes('chrome')) browser = 'chrome';
    else if (ua.includes('firefox')) browser = 'firefox';
    else if (ua.includes('safari')) browser = 'safari';
    else if (ua.includes('edge')) browser = 'edge';
    else if (ua.includes('opera')) browser = 'opera';
    
    // OS
    let os = 'unknown';
    if (ua.includes('windows')) os = 'windows';
    else if (ua.includes('mac')) os = 'macos';
    else if (ua.includes('linux')) os = 'linux';
    else if (ua.includes('android')) os = 'android';
    else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'ios';
    
    return { device_type, browser, os };
}



// ✅ ENHANCED PAYLOAD CONSTRUCTION
function enhanceEventPayload(eventPayload, user_data, enrichment_data, custom_data, startTime) {
    // Calcular qualidade com enrichment separado
    const qualityScore = calculateDataQuality(user_data, enrichment_data);
    
    eventPayload.data[0].custom_data = {
        ...custom_data,
        server_event: true,
        capi_version: "furion_v4_enhanced",
        processing_time: Date.now() - startTime,
        data_quality_score: qualityScore,
        enrichment_level: 'premium',
        matching_confidence: calculateMatchingConfidence(user_data, enrichment_data),
        user_value_score: calculateUserValueScore(user_data, enrichment_data, custom_data),
        // ✅ ENRICHMENT NO CUSTOM_DATA (PERMITIDO)
        ...enrichment_data
    };
    
    return eventPayload;
}



function calculateDataQuality(user_data, enrichment_data) {
    let score = 0;
    let maxScore = 0;
    
    // Email quality
    if (user_data.em) {
        score += enrichment_data.email_quality === 'premium' ? 25 : 15;
    }
    maxScore += 25;
    
    // Phone quality
    if (user_data.ph) {
        score += enrichment_data.phone_quality === 'mobile' ? 25 : 15;
    }
    maxScore += 25;
    
    // Name quality
    if (user_data.fn) {
        score += enrichment_data.name_quality === 'complete' ? 20 : 10;
    }
    maxScore += 20;
    
    // External ID quality
    if (user_data.external_id) {
        score += enrichment_data.external_id_quality === 'high' ? 15 : 10;
    }
    maxScore += 15;
    
    // Browser fingerprinting
    if (user_data.fbp) score += 10;
    if (user_data.fbc) score += 5;
    maxScore += 15;
    
    return Math.round((score / maxScore) * 100);
}



function calculateMatchingConfidence(user_data, enrichment_data) {
    let confidence = 0;
    
    if (user_data.em && enrichment_data.email_quality === 'premium') confidence += 30;
    else if (user_data.em) confidence += 20;
    
    if (user_data.ph && enrichment_data.phone_quality === 'mobile') confidence += 25;
    else if (user_data.ph) confidence += 15;
    
    if (user_data.external_id && enrichment_data.external_id_quality === 'high') confidence += 20;
    else if (user_data.external_id) confidence += 10;
    
    if (user_data.fbp) confidence += 15;
    if (user_data.fbc) confidence += 10;
    
    return Math.min(confidence, 100);
}



function calculateUserValueScore(user_data, enrichment_data, custom_data) {
    let score = 50;
    
    if (user_data.em) score += 10;
    if (user_data.ph) score += 10;
    if (user_data.fn && user_data.ln) score += 10;
    if (user_data.external_id) score += 5;
    
    if (enrichment_data.email_quality === 'premium') score += 10;
    if (enrichment_data.phone_quality === 'mobile') score += 5;
    if (enrichment_data.name_quality === 'complete') score += 5;
    
    if (custom_data.value && custom_data.value >= 25) score += 15;
    
    return Math.min(score, 100);
}


// FURION POWER - Multi-pixel sender with retry logic
async function sendToPixel(payload, retryCount = 0) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { error: true, message: "Pixel ou token não configurado" };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(result)}`);
    }

    return {
      success: true,
      events_received: result.events_received || 0,
      fbtrace_id: result.fbtrace_id || null
    };

  } catch (error) {
    console.error("Erro no envio:", error.message);

    if (retryCount < 2) {
      await new Promise(r => setTimeout(r, 1000));
      return sendToPixel(payload, retryCount + 1);
    }

    return {
      error: true,
      message: error.message
    };
  }
}



// FURION POWER - Main event handler
app.post("/event", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      event_name = "CustomEvent", 
      event_id, 
      event_source_url = "", 
      user = {}, 
      custom_data = {} 
    } = req.body;



    // FURION POWER - Skip server-side PageView to avoid duplication
    if (event_name && event_name.toLowerCase() === "pageview") {
      return res.json({ 
        ok: true, 
        skipped: "server_pageview_avoided",
        message: "PageView events should be client-side only"
      });
    }



    // FURION POWER - Enhanced user data processing
    // ✅ FURION POWER - PROCESSAMENTO MELHORADO DE DADOS
    // ✅ FURION POWER - PROCESSAMENTO MELHORADO DE DADOS + ENRICHMENT
    // ✅ FURION POWER - PROCESSAMENTO CORRIGIDO (SEM ENRICHMENT NO USER_DATA)
    const user_data = {};
    const enrichment_data = {}; // ✅ SEPARAR ENRICHMENT

   

    // ✅ EMAIL - Normalização + hash (APENAS HASH NO USER_DATA)
    if (user.email) {
        const cleanEmail = String(user.email)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/\.+/g, '.')
            .replace(/\+.*@/, '@');
        
        user_data.em = sha256(cleanEmail);
        console.log('✅ Email processado:', cleanEmail.substring(0, 3) + '***');
        
        // ✅ ENRICHMENT SEPARADO
        const domain = cleanEmail.split('@')[1];
        const premiumDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];
        enrichment_data.email_quality = premiumDomains.includes(domain) ? 'premium' : 'standard';
    }

   

    // ✅ TELEFONE - Normalização + hash (APENAS HASH NO USER_DATA)
    // ✅ TELEFONE - VALIDAÇÃO MELHORADA E MAIS FLEXÍVEL
    if (user.phone) {
        let cleanPhone = String(user.phone)
            .replace(/\D/g, '') // Remove todos os caracteres não numéricos
            .replace(/^0+/, ''); // Remove zeros iniciais
        
        console.log('📱 Telefone original recebido:', user.phone);
        console.log('📱 Telefone limpo inicial:', cleanPhone);
        
        // ✅ NORMALIZAÇÃO BRASILEIRA MELHORADA
        if (cleanPhone.length === 10) {
            // Telefone fixo (11) 9999-9999 -> adiciona 9
            cleanPhone = cleanPhone.substring(0, 2) + '9' + cleanPhone.substring(2);
        }
        
        if (cleanPhone.length === 11 && !cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
        }
        
        // ✅ VALIDAÇÃO MAIS FLEXÍVEL
        if (cleanPhone.length >= 11) { // ✅ ACEITA MAIS FORMATOS
            // Garantir que tenha pelo menos código do país
            if (!cleanPhone.startsWith('55') && cleanPhone.length === 11) {
                cleanPhone = '55' + cleanPhone;
            }
            
            user_data.ph = sha256(cleanPhone);
            console.log('✅ Telefone processado FINAL:', cleanPhone.substring(0, 4) + '***');
            console.log('✅ Hash do telefone gerado:', user_data.ph ? 'SUCCESS' : 'FAILED');
            
            // ✅ ENRICHMENT SEPARADO
            const areaCode = cleanPhone.length >= 4 ? cleanPhone.substring(2, 4) : '11';
            enrichment_data.phone_region = detectPhoneRegion(areaCode);
            enrichment_data.phone_quality = cleanPhone.length === 13 ? 'mobile' : 'landline';
            enrichment_data.phone_length = cleanPhone.length;
        } else {
            console.warn('⚠️ Telefone muito curto, ignorado:', cleanPhone);
        }
    }

   

    // ✅ NOME - Normalização + hash (APENAS HASH NO USER_DATA)
    if (user.name) {
        const cleanName = String(user.name)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\p{L}\s]/gu, '');
        
        const nameParts = cleanName.split(' ').filter(part => part.length > 1);
        
        if (nameParts.length > 0) {
            user_data.fn = sha256(nameParts[0]);
            console.log('✅ Primeiro nome processado:', nameParts[0].substring(0, 2) + '***');
            
            if (nameParts.length > 1) {
                user_data.ln = sha256(nameParts.slice(1).join(' '));
                console.log('✅ Sobrenome processado');
            }
            
            // ✅ ENRICHMENT SEPARADO
            enrichment_data.name_quality = nameParts.length >= 2 ? 'complete' : 'partial';
            enrichment_data.name_length = nameParts.length;
        }
    }

   

    // ✅ EXTERNAL_ID - Hash (APENAS HASH NO USER_DATA)
    if (user.external_id) {
        const cleanExternalId = String(user.external_id)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');
        
        user_data.external_id = sha256(cleanExternalId);
        console.log('✅ External ID processado:', cleanExternalId.substring(0, 5) + '***');
        
        // ✅ ENRICHMENT SEPARADO
        enrichment_data.external_id_quality = cleanExternalId.length > 20 ? 'high' : 'standard';
    }

   

    // ✅ BROWSER FINGERPRINTING (PERMITIDOS NO USER_DATA)
    if (user.fbp) {
        user_data.fbp = String(user.fbp).trim();
        console.log('✅ FBP capturado:', user.fbp.substring(0, 10) + '***');
    }

   

    if (user.fbc) {
        user_data.fbc = String(user.fbc).trim();
        console.log('✅ FBC capturado:', user.fbc.substring(0, 10) + '***');
    }

   

    // ✅ CLIENT DATA (PERMITIDOS NO USER_DATA)
    user_data.client_user_agent = req.headers["user-agent"] || "";

   

    user_data.client_ip_address = 
        req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.headers["x-real-ip"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        "unknown";

   

    console.log('✅ Client IP capturado:', user_data.client_ip_address);

   

    // ✅ DEVICE ANALYSIS SEPARADO
    if (user_data.client_user_agent) {
        const deviceInfo = analyzeUserAgent(user_data.client_user_agent);
        enrichment_data.device_type = deviceInfo.device_type;
        enrichment_data.browser_name = deviceInfo.browser;
        enrichment_data.os_name = deviceInfo.os;
        console.log('✅ Device info:', deviceInfo);
    }



    // FURION POWER - Event payload construction
    // ✅ FURION POWER - ENHANCED EVENT PAYLOAD CONSTRUCTION
    let eventPayload = {
        data: [{
            event_name,
            event_time: req.body.event_time || Math.floor(Date.now() / 1000),
            event_id: event_id || `srv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            event_source_url,
            action_source: "website",
            user_data,
            custom_data: {
                ...custom_data,
                server_event: true,
                capi_version: "furion_v4_enhanced",
                processing_time: Date.now() - startTime
            }
        }]
    };

  

    // ✅ APPLY ADVANCED ENRICHMENT
    eventPayload = enhanceEventPayload(eventPayload, user_data, enrichment_data, custom_data, startTime);

  

    // Add test event code if provided
    if (TEST_EVENT_CODE) {
        eventPayload.test_event_code = TEST_EVENT_CODE;
    }



    // FURION POWER - Send to all pixels concurrently
    const result = await sendToPixel(eventPayload);

    const totalTime = Date.now() - startTime;

    
        console.log(`📡 CAPI: ${event_name} | ${result.success ? 'SUCCESS' : 'ERROR'} | ${totalTime}ms`);
        
        // ✅ FURION POWER - LOG DETALHADO
        if (result.success) {
            console.log(`✅ Event ID: ${eventPayload.data[0].event_id}`);
            console.log(`✅ Events Received: ${result.events_received || 0}`);
            console.log(`✅ FB Trace: ${result.fbtrace_id || 'N/A'}`);
            
            // Log de dados processados (sem PII)
            const processedFields = Object.keys(user_data).filter(key => 
                !['client_ip_address', 'client_user_agent'].includes(key)
            );
            console.log(`✅ Campos processados: ${processedFields.join(', ')}`);
        } else {
            console.error(`❌ CAPI Error: ${result.message}`);
        }

    return res.json({
    ok: true,
    event_name,
    event_id: eventPayload.data[0].event_id,
    success: result.success || false,
    fbtrace_id: result.fbtrace_id || null,
    error: result.error || null
    });



    } catch (error) {
        console.error("FURION CAPI Error:", error);
        
        return res.status(500).json({
        ok: false,
        error: "Internal server error",
        message: error.message,
        event_name: req.body.event_name || "unknown",
        timestamp: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime
        });
    }
    });



// FURION POWER - Health check endpoint
app.get("/health", (req, res) => {
  const configured = !!ACCESS_TOKEN;
  
  res.json({
  status: "healthy",
  pixel_configured: configured,
  api_version: API_VERSION,
  test_mode: !!TEST_EVENT_CODE,
  timestamp: new Date().toISOString()
  });
});



// FURION POWER - Pixel configuration endpoint
app.get("/pixels", (req, res) => {
  res.json({
    pixel_id: PIXEL_ID,
    configured: !!ACCESS_TOKEN,
    masked_token: ACCESS_TOKEN ? ACCESS_TOKEN.substring(0, 8) + "..." : null
  });
});



// FURION POWER - Test endpoint
app.post("/test", async (req, res) => {
  try {
    const testPayload = {
      data: [{
        event_name: "Test",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `test_${Date.now()}`,
        action_source: "website",
        user_data: {
          em: sha256("test@teste.com")
        }
      }]
    };

    if (TEST_EVENT_CODE) {
      testPayload.test_event_code = TEST_EVENT_CODE;
    }

    const result = await sendToPixel(testPayload);

    res.json({
      test: true,
      success: result.success || false,
      response: result
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});



// FURION POWER - Analytics endpoint
app.get("/analytics", (req, res) => {
  // This could be expanded to include more detailed analytics
  res.json({
    service: "FURION POWER CAPI Analytics",
    message: "Analytics endpoint - implement based on your needs",
    available_endpoints: [
      "GET /health - Service health check",
      "GET /pixels - Pixel configuration info", 
      "POST /test - Test all configured pixels",
      "POST /event - Send events to pixels",
      "GET /analytics - This endpoint"
    ]
  });
});



// FURION POWER - Error handling middleware
app.use((err, req, res, next) => {
  console.error('FURION CAPI Unhandled Error:', err);
  
  res.status(500).json({
    ok: false,
    error: "Internal server error",
    message: "An unexpected error occurred",
    timestamp: new Date().toISOString()
  });
});



// FURION POWER - 404 handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Endpoint not found",
    message: `${req.method} ${req.path} is not available`,
    available_endpoints: ["/event", "/health", "/pixels", "/test", "/analytics"]
  });
});



// FURION POWER - Server startup
const PORT = process.env.PORT || 3000;



app.listen(PORT, () => {
  console.log(`🔥 FURION POWER CAPI Server running on port ${PORT}`);
  console.log(`📡 Pixel configurado: ${ACCESS_TOKEN ? 'SIM' : 'NÃO'}`);
  console.log(`⚡ API Version: ${API_VERSION}`);
  console.log(`🧪 Test mode: ${TEST_EVENT_CODE ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🚀 Ready to dominate conversions!`);
});



// FURION POWER - Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔥 FURION CAPI: Received SIGTERM, shutting down gracefully');
  process.exit(0);
});



process.on('SIGINT', () => {
  console.log('🔥 FURION CAPI: Received SIGINT, shutting down gracefully');  
  process.exit(0);
});



export default app;