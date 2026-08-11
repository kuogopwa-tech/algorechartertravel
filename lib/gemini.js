import { GoogleGenerativeAI } from "@google/generative-ai";
import { createAppError } from "./errors.js";

const DEFAULT_MODEL = "gemini-flash-latest";
const REQUEST_TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;

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
11. Never generate pictures, logos, or coding - say no politely and redirect to travel/business.
12. Stop repeating yourself if user already had a chat with you

When user clearly wants to book, collect (step by step, not all at once):
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

function buildGeminiHistory(history = [], currentMessage, customPrompt = "") {
  const contents = [];
  const fullPrompt = customPrompt ? `${SYSTEM_PROMPT}\n\nNote for current session: ${customPrompt}` : SYSTEM_PROMPT;
  
  contents.push({ role: "user", parts: [{ text: fullPrompt }] });
  contents.push({ role: "model", parts: [{ text: "I understand. I'm ready to help with travel inquiries. Please tell me about your travel needs." }] });
  
  for (const msg of history) {
    if (msg.role === "user" || msg.role === "assistant") {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      });
    }
  }
  
  contents.push({ role: "user", parts: [{ text: currentMessage }] });
  return contents;
}

async function callGeminiAPI({ userMessage, history = [], customSystemPrompt = "" } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  
  if (!apiKey) {
    throw createAppError("missing_gemini_api_key");
  }
  
  if (!userMessage) {
    throw createAppError("invalid_message");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const modelInstance = client.getGenerativeModel({ model });

  let lastError = createAppError("provider_unavailable");
  
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      const contents = buildGeminiHistory(history, userMessage, customSystemPrompt);
      
      // Set up abort controller for timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT_MS);
      
      try {
        const response = await Promise.race([
          modelInstance.generateContent({
            contents,
            generationConfig: {
              temperature: 0.55,
              maxOutputTokens: 2048,
              topP: 0.95,
              topK: 40
            }
          }),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), REQUEST_TIMEOUT_MS);
          })
        ]);

        clearTimeout(timeout);

        if (!response || !response.response) {
          throw createAppError("provider_invalid_shape");
        }

        const text = response.response.text();
        
        if (!text || typeof text !== "string") {
          throw createAppError("provider_invalid_shape");
        }

        return text.trim();
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    } catch (error) {
      console.warn("[Gemini API] Request failed:", {
        model,
        status: error?.status || error?.response?.status,
        message: error?.message
      });

      // Check for prompt blocking
      if (error?.message?.includes?.("SAFETY") || error?.message?.includes?.("blocked")) {
        return "I apologize, but I cannot fulfill that request due to safety policies. How can I help with your travel plans?";
      }

      // Handle timeout
      if (error?.message?.includes?.("timeout") || error?.name === "AbortError") {
        lastError = createAppError("provider_timeout");
      } else if (error?.status === 401 || error?.status === 403) {
        lastError = createAppError("provider_auth_error");
      } else if (error?.status === 429) {
        lastError = createAppError("provider_rate_limited");
      } else if (error?.status >= 500) {
        lastError = createAppError("provider_unavailable");
      } else {
        lastError = error?.code ? error : createAppError("provider_unavailable");
      }

      // Retry logic
      if (attempt <= MAX_RETRIES) {
        if (["provider_timeout", "provider_unavailable", "provider_rate_limited"].includes(lastError.code)) {
          const delay = lastError.code === "provider_rate_limited" ? RETRY_DELAYS[attempt - 1] : 250 * attempt;
          await sleep(delay);
          continue;
        }
      }
      
      break;
    }
  }

  throw lastError;
}

export { callGeminiAPI, buildGeminiHistory };
