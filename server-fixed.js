// Backend Node.js para el Generador LLM.txt con OpenAI - Versión Corregida
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cheerio = require("cheerio"); // Agrega esta línea junto a los otros require
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true, // Permitir cookies y autenticación
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10, // Máximo 10 requests por IP
  message: {
    error:
      "Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplica rate limit solo a /api/generate-llm
app.use("/api/generate-llm", limiter);

// Validación de URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return ["http:", "https:"].includes(url.protocol);
  } catch (error) {
    return false;
  }
}

// Prompt optimizado para OpenAI
function createPrompt(url, scraped = {}) {
  return `Actúa como un experto en SEO y análisis web. Tu tarea es analizar la siguiente URL y generar un archivo LLM.txt completo y estructurado.

URL a analizar: ${url}

--- DATOS REALES EXTRAÍDOS ---
Título: ${scraped.title || "No encontrado"}
Descripción: ${scraped.description || "No encontrada"}
H1: ${scraped.h1 || "No encontrado"}
H2: ${scraped.h2 || "No encontrados"}
------------------------------

IMPORTANTE: Usa estos datos reales para mejorar el análisis y las recomendaciones. Si falta información, infiere lo necesario.

# LLM.txt - [Título inferido de la URL]

## Información Básica del Sitio
- **URL:** ${url}
- **Dominio:** ${new URL(url).hostname}
- **Protocolo:** ${new URL(url).protocol}
- **Fecha de análisis:** ${new Date().toISOString().split("T")[0]}

## Análisis de la URL
- **Estructura de URL:** ${
    new URL(url).pathname
      ? "Estructura jerárquica clara"
      : "URL base del dominio"
  }
- **Longitud de URL:** ${url.length} caracteres
- **Parámetros:** ${
    new URL(url).search
      ? "Contiene parámetros de consulta"
      : "URL limpia sin parámetros"
  }

## Inferencias Basadas en el Dominio
Basándome en el dominio "${new URL(url).hostname}":

### Tipo de Sitio Probable
[Inferir si es comercial (.com), educativo (.edu), organizacional (.org), etc.]

### Palabras Clave Potenciales
[Extraer palabras clave del dominio y path de la URL]

### Estructura Recomendada para LLM.txt
1. **Metadatos básicos** - Título, descripción, autor
2. **Contenido principal** - Resumen del propósito del sitio
3. **Estructura de navegación** - Menús principales y páginas clave
4. **Información de contacto** - Datos de la empresa/organización
5. **Contexto SEO** - Keywords principales y mercado objetivo

## Recomendaciones SEO Específicas
- **Optimización de URL:** ${
    url.length > 100
      ? "Considerar acortar la URL (>100 caracteres)"
      : "Longitud de URL óptima"
  }
- **Protocolo HTTPS:** ${
    url.startsWith("https")
      ? "✅ Implementado correctamente"
      : "❌ Migrar a HTTPS prioritario"
  }
- **Estructura semántica:** Implementar datos estructurados Schema.org

## Contexto para LLMs
Este archivo LLM.txt está diseñado para proporcionar contexto sobre el sitio web localizado en ${url}.

### Propósito Inferido
[Basándose en la estructura de URL y dominio, inferir el propósito del sitio]

### Audiencia Objetivo Probable
[Inferir la audiencia basándose en el tipo de dominio y estructura]

### Contenido Esperado
[Describir qué tipo de contenido se esperaría encontrar en este sitio]

## Plantilla de Implementación

Para completar este LLM.txt con información real del sitio, incluir:

1. **Título real de la página**
2. **Meta descripción actual**
3. **Estructura de encabezados (H1-H6)**
4. **Contenido principal resumido**
5. **Enlaces internos importantes**
6. **Información de contacto**
7. **Productos/servicios principales**
8. **Blog/noticias (si aplica)**

## Métricas de Monitoreo Sugeridas
- Tiempo de carga de página
- Core Web Vitals
- Tasa de rebote
- Conversiones (si es e-commerce)
- Tráfico orgánico

---
*Este LLM.txt fue generado automáticamente por IA como estructura base. Se recomienda completar con información específica del sitio web real para maximizar su efectividad SEO.*

**Nota:** Para un análisis más preciso, se recomienda inspeccionar manualmente el contenido real del sitio web.`;
}

// Scraping básico de la página
async function scrapePage(url) {
  try {
    const { data: html } = await axios.get(url, { timeout: 15000 });
    const $ = cheerio.load(html);

    const title = $("title").text().trim();
    const description = $('meta[name="description"]').attr("content") || "";
    const h1 = $("h1").first().text().trim();
    const h2 = $("h2")
      .map((i, el) => $(el).text().trim())
      .get()
      .join(" | ");

    return {
      title,
      description,
      h1,
      h2,
    };
  } catch (error) {
    console.warn("No se pudo scrapear la página:", error.message);
    return {};
  }
}

// Middleware de logging
app.use("/api/", (req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`
  );
  next();
});

// Endpoint principal para generar LLM.txt
app.post("/api/generate-llm", async (req, res) => {
  const startTime = Date.now();

  try {
    const { url } = req.body;

    // Validaciones de entrada
    if (!url) {
      return res.status(400).json({
        error: "URL es requerida",
        code: "MISSING_URL",
      });
    }

    if (typeof url !== "string" || url.trim().length === 0) {
      return res.status(400).json({
        error: "URL debe ser una cadena válida",
        code: "INVALID_URL_FORMAT",
      });
    }

    if (!isValidUrl(url.trim())) {
      return res.status(400).json({
        error: "URL inválida. Debe incluir http:// o https://",
        code: "INVALID_URL",
      });
    }

    // Verificar configuración de OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY no está configurada");
      return res.status(500).json({
        error: "Configuración del servidor incompleta",
        code: "MISSING_API_KEY",
      });
    }

    const cleanUrl = url.trim();
    console.log(`Iniciando generación de LLM.txt para: ${cleanUrl}`);

    // Scraping antes de generar el prompt
    const scraped = await scrapePage(cleanUrl);
    console.log("Datos scrapeados:", scraped);

    // Configuración para la llamada a OpenAI
    const openaiConfig = {
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en SEO y análisis web especializado en generar archivos LLM.txt estructurados, útiles y optimizados para motores de búsqueda. Generas contenido práctico, bien formateado y accionable.",
        },
        {
          role: "user",
          content: createPrompt(cleanUrl, scraped), // <-- Aquí pasamos los datos scrapeados
        },
      ],
      max_tokens: parseInt(process.env.MAX_TOKENS) || 3000,
      temperature: parseFloat(process.env.TEMPERATURE) || 0.3,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    };

    // Llamada a OpenAI API con timeout y manejo de errores
    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      openaiConfig,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000, // 60 segundos
      }
    );

    // Validar respuesta de OpenAI
    if (
      !openaiResponse.data ||
      !openaiResponse.data.choices ||
      !openaiResponse.data.choices[0]
    ) {
      throw new Error("Respuesta inválida de OpenAI API");
    }

    const generatedContent = openaiResponse.data.choices[0].message?.content;

    if (!generatedContent || generatedContent.trim().length === 0) {
      throw new Error("OpenAI no generó contenido válido");
    }

    // Calcular métricas
    const processingTime = Date.now() - startTime;
    const tokensUsed = openaiResponse.data.usage?.total_tokens || 0;

    // Log de éxito
    console.log(`✅ LLM.txt generado exitosamente para: ${cleanUrl}`);
    console.log(
      `📊 Tokens utilizados: ${tokensUsed}, Tiempo: ${processingTime}ms`
    );

    // Respuesta exitosa
    res.json({
      success: true,
      content: generatedContent,
      url: cleanUrl,
      generated_at: new Date().toISOString(),
      processing_time_ms: processingTime,
      tokens_used: tokensUsed,
      model_used: openaiConfig.model,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(
      `❌ Error generando LLM.txt (${processingTime}ms):`,
      error.message
    );

    // Manejo específico de errores de OpenAI
    if (error.response?.data?.error) {
      const openaiError = error.response.data.error;

      const errorResponses = {
        invalid_api_key: {
          status: 401,
          message: "API Key de OpenAI inválida",
          code: "INVALID_API_KEY",
        },
        insufficient_quota: {
          status: 402,
          message: "Cuota de OpenAI excedida",
          code: "QUOTA_EXCEEDED",
        },
        rate_limit_exceeded: {
          status: 429,
          message: "Límite de velocidad de OpenAI excedido",
          code: "RATE_LIMIT",
        },
        model_not_found: {
          status: 404,
          message: "Modelo de OpenAI no disponible",
          code: "MODEL_NOT_FOUND",
        },
        context_length_exceeded: {
          status: 400,
          message: "Contenido demasiado largo para el modelo",
          code: "CONTENT_TOO_LONG",
        },
      };

      const errorInfo = errorResponses[openaiError.code] || {
        status: 500,
        message: openaiError.message || "Error desconocido de OpenAI",
        code: "OPENAI_ERROR",
      };

      return res.status(errorInfo.status).json({
        error: errorInfo.message,
        code: errorInfo.code,
        processing_time_ms: processingTime,
      });
    }

    // Manejo de errores de red/timeout
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return res.status(408).json({
        error: "Timeout: La solicitud tardó demasiado en procesarse",
        code: "TIMEOUT",
        processing_time_ms: processingTime,
      });
    }

    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "No se pudo conectar con OpenAI API",
        code: "CONNECTION_ERROR",
        processing_time_ms: processingTime,
      });
    }

    // Error genérico
    res.status(500).json({
      error: "Error interno del servidor",
      code: "INTERNAL_ERROR",
      processing_time_ms: processingTime,
    });
  }
});

// Endpoint de salud del servidor
app.get("/api/health", (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(uptime),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + " MB",
    },
    version: "1.0.0",
    node_version: process.version,
  });
});

// Endpoint para verificar configuración
app.get("/api/config", (req, res) => {
  res.json({
    openai_configured: !!process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4",
    max_tokens: parseInt(process.env.MAX_TOKENS) || 3000,
    temperature: parseFloat(process.env.TEMPERATURE) || 0.3,
    rate_limit: `${
      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10
    } requests per ${Math.floor(
      (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 60000
    )} minutes`,
    environment: process.env.NODE_ENV || "development",
  });
});

// Ruta raíz
app.get("/", (req, res) => {
  res.json({
    message: "🤖 Generador LLM.txt con IA - API funcionando",
    version: "1.0.0",
    endpoints: {
      generate: "POST /api/generate-llm",
      health: "GET /api/health",
      config: "GET /api/config",
    },
  });
});

// Manejo de rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({
    error: "Endpoint no encontrado",
    path: req.path,
    method: req.method,
    available_endpoints: [
      "POST /api/generate-llm",
      "GET /api/health",
      "GET /api/config",
      "GET /",
    ],
  });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  console.error("Error no manejado:", error);
  res.status(500).json({
    error: "Error interno del servidor",
    code: "UNHANDLED_ERROR",
    timestamp: new Date().toISOString(),
  });
});

// Manejo de señales del sistema
process.on("SIGTERM", () => {
  console.log("SIGTERM recibido, cerrando servidor...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT recibido, cerrando servidor...");
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log("");
  console.log("🚀 ========================================");
  console.log(`   Servidor iniciado en puerto ${PORT}`);
  console.log("🚀 ========================================");
  console.log(`📊 Endpoints disponibles:`);
  console.log(`   • http://localhost:${PORT}/`);
  console.log(`   • http://localhost:${PORT}/api/generate-llm`);
  console.log(`   • http://localhost:${PORT}/api/health`);
  console.log(`   • http://localhost:${PORT}/api/config`);
  console.log("");
  console.log(`🔧 Configuración:`);
  console.log(
    `   • OpenAI: ${
      !!process.env.OPENAI_API_KEY ? "✅ Configurado" : "❌ No configurado"
    }`
  );
  console.log(`   • Modelo: ${process.env.OPENAI_MODEL || "gpt-4"}`);
  console.log(
    `   • Rate Limit: ${
      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10
    } req/15min`
  );
  console.log(`   • Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log("");

  if (!process.env.OPENAI_API_KEY) {
    console.log("⚠️  ADVERTENCIA: OPENAI_API_KEY no está configurada");
    console.log("   Crea un archivo .env con tu API key de OpenAI");
    console.log("");
  }
});

module.exports = app;
