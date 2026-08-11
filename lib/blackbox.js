import { createAppError } from "./errors.js";

const DEFAULT_MODEL = "blackboxai/openai/gpt-4o";
const REQUEST_TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;
const BLACKBOX_BASE_URL = "https://api.blackbox.ai/v1";

// System prompt for the AI
const SYSTEM_PROMPT = `
You are Algore Charter Travels' friendly AI travel concierge.

Voice and tone:
- Warm, natural, and human (not robotic)
- Conversational like a friendly Kenyan travel assistant
- Use concise replies first, then details only when needed
- Mix simple Kiswahili + English naturally when appropriate
- Light humor is okay when suitable and professional
- Calm and emotionally aware; never pushy

Core scope:
- Tours, holidays, visas, flights, hotels, safaris, destinations
- Recruitment/work-abroad opportunities supported by Algore Charter Travels

Official verified company contacts (use ONLY these when user asks to contact/escalate):
- Director: Mr. Joe Bakari
- Kenya (main office): +254700070014
- Office Alt Kenya: +254101070014
- Qatar/UAE line: +97433686108
- Office Qatar: +97474703290
- Email: algorechartertravels@gmail.com
- Working Hours: Mon - Sat, 8:00 AM - 7:00 PM

Conversation behavior:
1. Greetings should feel natural (e.g. hi, hello, mambo, habari, good afternoon).
2. Short destination follow-ups like "Mombasa", "Diani", "Dubai" are valid and should continue the travel conversation.
3. Answer the user's exact question first, clearly and directly.
4. Do NOT always add extra offers like "I can also help..." or "Would you like me to...".
5. Do NOT always ask a follow-up question.
6. Only offer extra help when user is confused, asks for more, seems stuck, or explicitly wants guidance.
7. If topic is unrelated, respond briefly with light humor when appropriate, then gently redirect to travel/recruitment help.
8. Never be harsh unless the request is clearly unsafe.
9. Avoid repeating the same fallback line.
10. Never invent confirmed bookings, approvals, pricing, or availability.
11. Never generate pictures,logo,coding or anything related, in pm deva polite way or say no and redirect back to business again.
12. Never generate pictures.
13. Never generate logo.
14. stop repeating yourself if user already had a chart with you

When user clearly wants to book, collect (step by step, not all the time):
- Destination
- Travel dates
- Number of travelers
- Budget (optional)
- Contact phone/email

Example style:
"Mambo 😄 Karibu Algore Charter Travels! Leo twende Dubai ama Diani? ✈️"

Response style guardrails:
- For straightforward factual questions, give the answer and STOP.
- Keep most replies to 1-3 short sentences unless user asks for details.
- Avoid salesy endings.
- Do NOT generate long fictional stories, fantasy narratives, or roleplay conversations.
- If user is playful (jokes/casual banter), reply briefly in a fun human way, then smoothly return to travel/business help.
- Never produce multi-paragraph storytelling.
- Never invent contact details.
- Only provide contacts when user asks to contact the company or needs escalation.
- Prefer main Kenya office number first for East African users: +254700070014.
- Do not dump all numbers unless user asks for all branches/regions.
- Share contacts naturally and conversationally.
`.trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRY_DELAYS = [2000, 4000];

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function isRateLimitedStatus(status) {
  return status === 429;
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

// Build Blackbox/OpenAI history format
function buildBlackboxMessages(history = [], currentMessage, customPrompt = "") {
  const fullPrompt = customPrompt ? `${SYSTEM_PROMPT}\n\nNote for current session: ${customPrompt}` : SYSTEM_PROMPT;
  const messages = [{ role: "system", content: fullPrompt }];
  for (const msg of history) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
      });
    }
  }
  messages.push({ role: "user", content: currentMessage });
  return messages;
}

async function callGeminiAPI({ userMessage, history = [], customSystemPrompt = "" }) {
  // Gemini calls should use the gemini module, not this file
  throw createAppError("provider_unavailable");
}

async function callBlackboxAPI_Actual({ userMessage, history = [], customSystemPrompt = "" }) {
  const apiKey = process.env.BLACKBOX_API_KEY;
  const model = process.env.BLACKBOX_MODEL || DEFAULT_MODEL;
  if (!apiKey) throw createAppError("missing_blackbox_api_key");

  const endpoint = `${process.env.BLACKBOX_BASE_URL || BLACKBOX_BASE_URL}/chat/completions`;
  const payload = {
    model,
    messages: buildBlackboxMessages(history, userMessage, customSystemPrompt),
    temperature: 0.55,
    max_tokens: 2048
  };

  return performApiCall(endpoint, payload, "blackbox");
}

async function performApiCall(endpoint, payload, type) {
  let lastError = createAppError("provider_unavailable");
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      const headers = { "Content-Type": "application/json", Accept: "application/json" };
      if (type === "blackbox") {
        headers["Authorization"] = `Bearer ${process.env.BLACKBOX_API_KEY}`;
      }

      const response = await safeFetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      }, REQUEST_TIMEOUT_MS);

      const rawText = await response.text().catch(() => "");

      if (!response.ok) {
        if (rawText.includes("ExceededBudget") || rawText.includes("budget_exceeded")) {
          throw createAppError("provider_budget_exceeded", { status: response.status });
        }
        if (attempt <= MAX_RETRIES && isRetryableStatus(response.status)) {
          const delay = isRateLimitedStatus(response.status) ? RETRY_DELAYS[attempt - 1] : 250 * attempt;
          await sleep(delay);
          continue;
        }
        throw createAppError(normalizeProviderError(response.status), { status: response.status });
      }

      let data;
      try { data = JSON.parse(rawText); } catch { 
        console.error(`[Blackbox API] JSON Parse Error:`, rawText.substring(0, 500));
        throw createAppError("provider_invalid_json"); 
      }

      const content = data?.choices?.[0]?.message?.content;

      if (!content || typeof content !== "string") throw createAppError("provider_invalid_shape");
      return content.trim();
    } catch (error) {
      lastError = error?.code ? error : createAppError("provider_unavailable");
      if (attempt <= MAX_RETRIES && ["provider_timeout", "provider_unavailable", "provider_rate_limited"].includes(lastError.code)) {
        const delay = (lastError.code === "provider_rate_limited") ? RETRY_DELAYS[attempt - 1] : 250 * attempt;
        await sleep(delay);
        continue;
      }
      break;
    }
  }
  throw lastError;
}

async function callAI(params) {
  const provider = process.env.AI_PROVIDER || "blackbox";
  if (provider === "blackbox") {
    return callBlackboxAPI_Actual(params);
  }
  return callBlackboxAPI_Actual(params);
}

// Compatibility exports
export { callAI, callBlackboxAPI_Actual as callBlackboxAI };
