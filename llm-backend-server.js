// Backend Node.js para el Generador LLM.txt con OpenAI
// Archivo: server.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 requests por IP por ventana
  message: {
    error:
      "Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos.",
  },
});

app.use("/api/", limiter);

// Validación de URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return ["http:", "https:"].includes(url.protocol);
  } catch (_) {
    return false;
  }
}

// Prompt optimizado para OpenAI
function createPrompt(url) {
  return `Actúa como un experto en SEO y análisis web. Tu tarea es analizar la siguiente URL y generar un archivo LLM.txt completo y estructurado.

URL a analizar: ${url}

IMPORTANTE: No puedo acceder directamente a URLs, pero basándome en la URL proporcionada y en las mejores prácticas de SEO, genera un archivo LLM.txt que incluya:

# LLM.txt - [Título inferido de la URL]

## Información Básica del Sitio
- **URL:** ${url}
- **Título inferido:** [Basado en la estructura de la URL]
- **Dominio:** [Extraído de la URL]
- **Tipo de sitio:** [Inferido de la estructura]
- **Fecha de análisis:** ${new Date().toISOString().split("T")[0]}

## Análisis de la URL
- **Estructura:** [Análisis de la limpieza y estructura de la URL]
- **Palabras clave en URL:** [Identificar keywords en la URL]
- **Jerarquía:** [Análisis de la estructura de carpetas]

## Recomendaciones SEO
- **Optimización de URL:** [Sugerencias basadas en la estructura]
- **Palabras clave sugeridas:** [Basadas en el dominio y path]
- **Estructura recomendada:** [Para LLM.txt específico]

## Contexto para LLMs
Este archivo LLM.txt está diseñado para proporcionar contexto sobre el sitio web localizado en ${url}. 

### Información Inferida:
[Inferir el propósito del sitio basándose en el dominio y estructura de URL]

### Recomendaciones:
1. Verificar que el contenido real coincida con esta estructura
2. Actualizar este archivo con información específica del contenido
3. Incluir datos estructurados relevantes
4. Mantener actualizada la información de contacto y metadatos

## Plantilla para Completar
Para completar este LLM.txt, se recomienda añadir:
- Contenido real de la página
- Meta descripciones actuales
- Estructura de encabezados real
- Enlaces internos y externos
- Información específica del negocio/contenido

---
*Este LLM.txt fue generado automáticamente por IA como punto de partida. Se recomienda revisar y completar con información específica del sitio web.*`;
}

// Endpoint principal para generar LLM.txt
app.post("/api/generate-llm", async (req, res) => {
  try {
    const { url } = req.body;

    // Validaciones
    if (!url) {
      return res.status(400).json({
        error: "URL es requerida",
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        error: "URL inválida. Debe incluir http:// o https://",
      });
    }

    // Verificar API Key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "API Key de OpenAI no configurada en el servidor",
      });
    }

    console.log(`Generando LLM.txt para: ${url}`);

    // Llamada a OpenAI API
    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "Eres un experto en SEO y análisis web especializado en generar archivos LLM.txt estructurados y útiles para optimización de motores de búsqueda. Generas contenido práctico y bien estructurado. Debes analizar la web para lograr tu objetivo: ayudar a los usuarios a crear un archivo LLM.txt que sea informativo y fácil de entender para los motores de búsqueda y usuarios finales.",
          },
          {
            role: "user",
            content: createPrompt(url),
          },
        ],
        max_tokens: parseInt(process.env.MAX_TOKENS) || 3000,
        temperature: parseFloat(process.env.TEMPERATURE) || 0.3,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000, // 60 segundos timeout
      }
    );

    const generatedContent = openaiResponse.data.choices[0]?.message?.content;

    if (!generatedContent) {
      return res.status(500).json({
        error: "No se pudo generar contenido",
      });
    }

    // Log para monitoreo
    console.log(`LLM.txt generado exitosamente para: ${url}`);
    console.log(
      `Tokens usados: ${openaiResponse.data.usage?.total_tokens || "N/A"}`
    );

    res.json({
      success: true,
      content: generatedContent,
      url: url,
      generated_at: new Date().toISOString(),
      tokens_used: openaiResponse.data.usage?.total_tokens || 0,
    });
  } catch (error) {
    console.error("Error generando LLM.txt:", error.message);

    // Manejo específico de errores de OpenAI
    if (error.response?.data?.error) {
      const openaiError = error.response.data.error;

      let errorMessage = "Error de OpenAI";
      let statusCode = 500;

      switch (openaiError.code) {
        case "invalid_api_key":
          errorMessage = "API Key de OpenAI inválida";
          statusCode = 401;
          break;
        case "insufficient_quota":
          errorMessage = "Cuota de OpenAI excedida";
          statusCode = 402;
          break;
        case "rate_limit_exceeded":
          errorMessage = "Límite de velocidad de OpenAI excedido";
          statusCode = 429;
          break;
        case "model_not_found":
          errorMessage = "Modelo de OpenAI no encontrado";
          statusCode = 404;
          break;
        default:
          errorMessage = openaiError.message || "Error desconocido de OpenAI";
      }

      return res.status(statusCode).json({
        error: errorMessage,
        code: openaiError.code,
      });
    }

    // Otros errores
    if (error.code === "ECONNABORTED") {
      return res.status(408).json({
        error: "Timeout: La solicitud tardó demasiado en procesarse",
      });
    }

    res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

// Endpoint de salud
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Endpoint para validar configuración
app.get("/api/config", (req, res) => {
  res.json({
    openai_configured: !!process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4",
    max_tokens: parseInt(process.env.MAX_TOKENS) || 3000,
    rate_limit: "10 requests per 15 minutes",
  });
});

// Manejo de errores 404
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Endpoint no encontrado",
  });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  console.error("Error no manejado:", error);
  res.status(500).json({
    error: "Error interno del servidor",
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(
    `📊 Endpoint principal: http://localhost:${PORT}/api/generate-llm`
  );
  console.log(`🔧 Configuración: http://localhost:${PORT}/api/config`);
  console.log(`❤️  Salud: http://localhost:${PORT}/api/health`);
  console.log(
    `🌍 OpenAI configurado: ${!!process.env.OPENAI_API_KEY ? "✅" : "❌"}`
  );

  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️  ADVERTENCIA: OPENAI_API_KEY no está configurada");
  }
});

module.exports = app;
