import { createAppError } from "./errors.js";

const DEFAULT_MODEL = "blackboxai/openai/gpt-5.3-codex";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;

const SYSTEM_PROMPT = `
You are the friendly AI concierge for Algore Charter Travels.

Tone and style:
- Warm, welcoming, professional, and human
- Natural and conversational (like a helpful travel consultant on WhatsApp)
- Short, clear, and helpful responses
- Never robotic, repetitive, harsh, or overly strict

You help users with:
- Dubai packages
- Visas
- Holiday trips
- Safaris
- Flights
- Hotel bookings
- Travel guidance
- Recruitment opportunities offered by Algore Charter Travels

Behavior rules:
1. Stay focused on Algore Charter Travels services.
2. If a user asks something unrelated, respond politely and gently redirect back to travel or company services.
3. Do not use harsh refusal language.
4. Ask follow-up questions when needed to understand customer plans.
5. Guide users naturally toward booking or inquiry completion.
6. Encourage collecting trip details in a friendly way.
7. Never invent confirmed bookings, visa approvals, prices, or availability.

When user shows booking intent, naturally ask for:
- Destination
- Travel dates
- Number of travelers
- Budget range (optional)
- Contact name and phone/email

Example redirection style:
"I’d love to help with your travel plans, visa support, holiday packages, or safari bookings 😊"

Do not repeatedly say:
"I can only help with..."
`.trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function normalizeProviderError(status) {
  if (status === 401 || status === 403) return "provider_auth_error";
  if (status === 429) return "provider_rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_unavailable";
}

async function safeFetch(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError" || String(error?.message || "").includes("timeout")) {
      throw createAppError("provider_timeout");
    }
    throw createAppError("provider_unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

async function callBlackboxAI({ userMessage, history = [] }) {
  const apiKey = process.env.BLACKBOX_API_KEY;
  const model = process.env.BLACKBOX_MODEL || DEFAULT_MODEL;
  const baseUrl = process.env.BLACKBOX_BASE_URL || "https://api.blackbox.ai";

  if (!apiKey) throw createAppError("missing_blackbox_api_key");
  if (!baseUrl) throw createAppError("missing_blackbox_base_url");

  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const payload = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: userMessage }
    ],
    temperature: 0.3
  };

  let lastError = createAppError("provider_unavailable");

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      const response = await safeFetch(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(payload)
        },
        REQUEST_TIMEOUT_MS
      );

      const rawText = await response.text().catch(() => "");

      if (!response.ok) {
        const code = normalizeProviderError(response.status);
        const err = createAppError(code, { status: response.status });
        if (attempt <= MAX_RETRIES && isRetryableStatus(response.status)) {
          await sleep(250 * attempt);
          continue;
        }
        throw err;
      }

      let data;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw createAppError("provider_invalid_json");
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw createAppError("provider_invalid_shape");
      }

      return content.trim();
    } catch (error) {
      lastError = error?.code ? error : createAppError("provider_unavailable");
      const code = lastError.code || "provider_unavailable";
      const retryable = code === "provider_timeout" || code === "provider_unavailable" || code === "provider_rate_limited";
      if (attempt <= MAX_RETRIES && retryable) {
        await sleep(250 * attempt);
        continue;
      }
      break;
    }
  }

  throw lastError;
}

export { callBlackboxAI };
