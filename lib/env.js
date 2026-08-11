import { createAppError } from "./errors.js";

let validated = false;

function validateEnv() {
  if (validated) return;

  // Gemini provider API key must be set
  const hasGeminiKey = process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim();

  if (!hasGeminiKey) {
    throw createAppError("missing_required_env", {
      missing: ["GEMINI_API_KEY"]
    });
  }

  validated = true;
}

export { validateEnv };
