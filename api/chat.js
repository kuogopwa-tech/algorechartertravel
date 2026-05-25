const { callBlackboxAI } = require("../lib/blackbox");

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

// Vercel Serverless Function: /api/chat
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    if (!process.env.BLACKBOX_API_KEY) {
      return res.status(500).json({
        error: "Server configuration missing: BLACKBOX_API_KEY is not set.",
      });
    }

    const body = await parseBody(req);
    const { message, history } = body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
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
      : [];

    const reply = await callBlackboxAI({
      userMessage: message.trim(),
      history: cleanedHistory,
    });

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("[/api/chat ERROR]", error.message);
    return res.status(500).json({
      error: error.message || "Assistant temporarily unavailable.",
    });
  }
};