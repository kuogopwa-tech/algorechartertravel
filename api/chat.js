const { callBlackboxAI } = require("../lib/blackbox");

// Vercel Serverless Function: /api/chat
module.exports = async (req, res) => {
  // Basic method guard
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { message, history } = req.body || {};

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
      error:
        "Sorry, the assistant is temporarily unavailable. Please try again shortly.",
    });
  }
};