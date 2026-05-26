const DEFAULT_MODEL = "blackboxai/openai/gpt-5.3-codex";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;

function buildSystemPrompt() {
  return [
    "You are Algore Charter Travels AI Assistant.",
    "Be professional, concise, and helpful.",
    "Company tagline: Dreams Are Possible.",
    "Services: Visa Applications, Hotel Booking, Flight Booking, Travel Insurance, Work Abroad Links, Recruitment Services, Tours & Travel, Charter Flights, Car/Lorry/Bus Hire.",
    "Recruitment focus: Gulf jobs, skilled & unskilled opportunities, international workforce solutions.",
    "Recruitment countries: UAE, Qatar, Lebanon, Saudi Arabia, Bahrain, Egypt, Iraq, Oman, Jordan, Kuwait, Turkey, Thailand, Poland.",
    "Contact: Director Mr. Joe Bakari. Kenya +254700070014, +97433686108, algorechartertravels@gmail.com.",
    "If the user wants booking/recruitment, ask key details: destination/country, travel dates, number of travelers/candidates, budget/role, and contact number."
  ].join(" ");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function normalizeProviderError(status, bodyText) {
  if (status === 401 || status === 403) return "provider_auth_error";
  if (status === 429) return "provider_rate_limited";
  if (status >= 500) return "provider_unavailable";
  return `provider_http_${status}`;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function callBlackboxAI({ userMessage, history = [] }) {
  const apiKey = process.env.BLACKBOX_API_KEY;
  const model = process.env.BLACKBOX_MODEL || DEFAULT_MODEL;
  const baseUrl = process.env.BLACKBOX_BASE_URL || "https://api.blackbox.ai";

  if (!apiKey) throw new Error("missing_blackbox_api_key");
  if (!baseUrl) throw new Error("missing_blackbox_base_url");

  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...history,
    { role: "user", content: userMessage },
  ];

  const payload = {
    model,
    messages,
    temperature: 0.6,
  };

  let lastError = new Error("provider_unavailable");

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
        REQUEST_TIMEOUT_MS
      );

  const rawText = await response.text().catch(() => "");

      if (!response.ok) {
        const code = normalizeProviderError(response.status, rawText);
        const error = new Error(code);
        error.status = response.status;
        error.rawBody = rawText;

        if (attempt <= MAX_RETRIES && isRetryableStatus(response.status)) {
          await sleep(250 * attempt);
          continue;
        }

        throw error;
      }

      let data;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseError) {
        const error = new Error("provider_invalid_json");
        error.rawBody = rawText;
        error.cause = parseError;
        throw error;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        const error = new Error("provider_invalid_shape");
        error.data = data;
        throw error;
      }

      return content.trim();
    } catch (error) {
      lastError = error;
      const isAbort = error?.name === "AbortError" || String(error?.message || "").includes("timeout");
      const isTransient = isAbort || String(error?.message || "").includes("fetch") || String(error?.message || "").includes("network");

      if (attempt <= MAX_RETRIES && isTransient) {
        await sleep(250 * attempt);
        continue;
      }

      break;
    }
  }

  throw lastError;
}

module.exports = {
  callBlackboxAI,
};
