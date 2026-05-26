import { createAppError } from "./errors.js";

const ROLE_ALLOWED = new Set(["user", "assistant"]);
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_ITEMS = 10;
const MAX_HISTORY_CONTENT = 2000;

const BLOCK_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /reveal\s+(the\s+)?system\s+prompt/i,
  /\b(jailbreak|dan mode|developer mode)\b/i,
  /\b(roleplay|pretend you are|act as)\b/i,
  /\boverride\b.*\brules?\b/i,
  /\b(prompt\s*injection|bypass|disable)\b.*\b(safety|guardrails?|policy|filters?)\b/i,
  /\b(show|print|dump|leak|extract)\b.*\b(system\s*prompt|hidden\s*prompt|developer\s*message|instructions?)\b/i,
  /\b(simulate|impersonate)\b.*\b(system|developer|admin)\b/i,
  /\b(make up|fabricate|invent)\b.*\b(source|citation|url|reference)\b/i,
  /\bwithout\s+sources?\b/i,
  /\bunsafe\b.*\b(request|task|instruction)\b/i
];

const GREETING_PATTERNS = [
  /\bhi+\b/i,
  /\bhello+\b/i,
  /\bhey+\b/i,
  /\bgood\s+morning\b/i,
  /\bgood\s+afternoon\b/i,
  /\bgood\s+evening\b/i,
  /\bhabari\b/i,
  /\bmambo\b/i,
  /\bniaje\b/i,
  /\bsasa\b/i,
  /\bhow\s+are\s+you\b/i,
  /\bgreetings?\b/i
];

const DOMAIN_PATTERNS = [
  /\btravel\b/i,
  /\btrip(s)?\b/i,
  /\bholiday\b/i,
  /\bpackage(s)?\b/i,
  /\bdubai\b/i,
  /\bvisa\b/i,
  /\bhotel\b/i,
  /\bflight(s)?\b/i,
  /\bsafari\b/i,
  /\brecruitment\b/i,
  /\bjobs?\b/i,
  /\bbooking\b/i,
  /\btours?\b/i,
  /\bcharter\b/i,
  /\binsurance\b/i
];

async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw createAppError("invalid_json");
  }
}

function validateMethod(req, allowed = ["POST"]) {
  if (!allowed.includes(req.method)) {
    throw createAppError("invalid_method", { allowed });
  }
}

function validateMessageInput(message) {
  if (typeof message !== "string") throw createAppError("invalid_message");
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) throw createAppError("invalid_message");
  if (normalized.length > MAX_MESSAGE_LENGTH) throw createAppError("message_too_long");
  return normalized;
}

function validateHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (m) =>
        m &&
        ROLE_ALLOWED.has(m.role) &&
        typeof m.content === "string"
    )
    .slice(-MAX_HISTORY_ITEMS)
    .map((m) => ({
      role: m.role,
      content: m.content.replace(/\s+/g, " ").trim().slice(0, MAX_HISTORY_CONTENT)
    }));
}

function assertNoPromptInjection(text) {
  if (BLOCK_PATTERNS.some((p) => p.test(text))) {
    throw createAppError("prompt_injection_blocked");
  }
}

function isGreetingMessage(text) {
  if (typeof text !== "string") return false;
  return GREETING_PATTERNS.some((p) => p.test(text));
}

function assertDomainAllowed(text) {
  const isGreeting = isGreetingMessage(text);
  const isDomainMessage = DOMAIN_PATTERNS.some((p) => p.test(text));

  if (!isGreeting && !isDomainMessage) {
    throw createAppError("non_domain_request");
  }
}


function ensureWebGroundedResponse(text) {
  const hasUrl = /https?:\/\/[^\s)]+/i.test(text);
  if (!hasUrl) {
    throw createAppError("unverified_response");
  }

  const fakeSourceClaims = [
    /\bsource:\s*(none|n\/a|na)\b/i,
    /\bcitation:\s*(none|n\/a|na)\b/i,
    /\baccording to reliable sources\b(?!.*https?:\/\/)/i
  ];

  if (fakeSourceClaims.some((p) => p.test(text))) {
    throw createAppError("unverified_response");
  }
}

export {
  parseJsonBody,
  validateMethod,
  validateMessageInput,
  validateHistory,
    assertNoPromptInjection,
  assertDomainAllowed,
  isGreetingMessage,
  ensureWebGroundedResponse
};

