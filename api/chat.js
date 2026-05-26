const { callBlackboxAI } = require("../lib/blackbox");

const IS_PROD = process.env.NODE_ENV === "production";
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 15;
const ipBuckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const prev = ipBuckets.get(ip);

  if (!prev || now - prev.start > RATE_WINDOW_MS) {
    ipBuckets.set(ip, { start: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (prev.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  prev.count += 1;
  ipBuckets.set(ip, prev);
  return { allowed: true, remaining: RATE_LIMIT - prev.count };
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("invalid_json");
  }
}

function normalizeUserError(code) {
  switch (code) {
    case "missing_blackbox_api_key":
    case "missing_blackbox_base_url":
      return "Our assistant is currently being configured. Please try again shortly.";
    case "provider_auth_error":
      return "The assistant is temporarily unavailable. Please try again shortly.";
    case "provider_rate_limited":
      return "The assistant is currently busy. Please try again in a moment.";
    case "provider_unavailable":
    case "provider_invalid_json":
    case "provider_invalid_shape":
    case "AbortError":
      return "Our AI assistant is temporarily unavailable. Please try again shortly.";
    case "invalid_json":
      return "Invalid request format. Please refresh and try again.";
    default:
      return "Sorry, our AI assistant is temporarily unavailable. Please try again shortly.";
  }
}

// Vercel Serverless Function: /api/chat
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(ip);

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-RateLimit-Remaining", String(rate.remaining));

    if (!rate.allowed) {
      if (!IS_PROD) console.warn("[/api/chat] rate limited", { ip });
      return res.status(429).json({
        error: "Too many requests. Please wait a moment and try again.",
      });
    }

    if (!process.env.BLACKBOX_API_KEY) {
      console.error("[/api/chat] Missing BLACKBOX_API_KEY");
      return res.status(500).json({
        error: normalizeUserError("missing_blackbox_api_key"),
      });
    }

    const body = await parseBody(req);
    const rawMessage = typeof body?.message === "string" ? body.message : "";
    const message = rawMessage.replace(/\s+/g, " ").trim();
    const history = body?.history;

    if (!message) {
      return res.status(400).json({ error: "Please enter a message." });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: "Message is too long. Please keep it under 1000 characters." });
    }

    const cleanedHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-10)
          .map((m) => ({
            role: m.role,
            content: m.content.replace(/\s+/g, " ").trim().slice(0, 2000),
          }))
      : [];

    const reply = await callBlackboxAI({
      userMessage: message,
      history: cleanedHistory,
    });

    return res.status(200).json({ reply });
  } catch (error) {
    // Keep detailed diagnostic information in server logs only.
    console.error("[/api/chat ERROR]", {
      message: error?.message,
      status: error?.status,
      stack: error?.stack,
      rawBody: error?.rawBody,
    });

    return res.status(500).json({
      error: normalizeUserError(error?.message),
    });
  }`n}`n
