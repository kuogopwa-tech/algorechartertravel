/**
 * Provider Manager
 * Handles the configured Gemini AI provider
 */

import { callGeminiAPI } from "./gemini.js";
import { createAppError } from "./errors.js";

const PROVIDER_GEMINI = "gemini";

/**
 * Main AI call function
 * 
 * @param {Object} params - { userMessage, history, customSystemPrompt }
 * @returns {Promise<string>} - AI response
 */
export async function callAI(params) {
  if (!!process.env.GEMINI_API_KEY) {
    try {
      console.log(`[AI] Calling ${PROVIDER_GEMINI} provider`);
      const response = await callGeminiAPI(params);
      console.log(`[AI] ${PROVIDER_GEMINI} provider succeeded`);
      return response;
    } catch (error) {
      console.warn(`[AI] ${PROVIDER_GEMINI} provider failed:`, error?.code || error?.message);
      throw error;
    }
  }

  throw createAppError("missing_gemini_api_key");
}

/**
 * Validate that Gemini provider is configured
 */
export function validateProviders() {
  const hasGemini = !!process.env.GEMINI_API_KEY;

  if (!hasGemini) {
    throw createAppError("missing_required_env", {
      missing: ["GEMINI_API_KEY"]
    });
  }
}

/**
 * Get provider info for logging/debugging
 */
export function getProviderInfo() {
  return {
    primary: PROVIDER_GEMINI,
    gemini: {
      available: !!process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-flash-latest"
    }
  };
}

// Compatibility export
export { callAI as default };
