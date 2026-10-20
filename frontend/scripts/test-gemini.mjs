
import dotenv from "dotenv";
// Verificación manual de conectividad con Gemini; requiere configuración local y genera una llamada externa.
dotenv.config({ path: ".env.local" });
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

if (!apiKey) {
  console.error("Error: no se encontró GEMINI_API_KEY.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

try {
  console.log(`Consultando modelo: ${model}`);

  const response = await ai.models.generateContent({
    model,
    contents:
      'Responde únicamente con este JSON: {"estado":"ok","mensaje":"Gemini responde"}',
    config: {
      responseMimeType: "application/json",
    },
  });

  console.log("Respuesta recibida:");
  console.log(response.text);
} catch (error) {
  console.error("Falló la consulta a Gemini.");

  if (error.status) {
    console.error("Código HTTP:", error.status);
  }

  console.error(
    error.message?.replace(apiKey, "[CLAVE OCULTA]") ??
      "Error sin detalles disponibles."
  );

  process.exit(1);
}

