const express = require("express");
const path = require("path");
require("dotenv").config();

const { callBlackboxAI } = require("./lib/blackbox");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Algore Charter Travels AI backend" });
});

// Secure backend route for AI assistant
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const cleanedHistory = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-10)
      : [];

    const reply = await callBlackboxAI({
      userMessage: message.trim(),
      history: cleanedHistory
    });

    return res.json({ reply });
  } catch (error) {
    console.error("[AI CHAT ERROR]", error.message);
    return res.status(500).json({
      error: "Sorry, the assistant is temporarily unavailable. Please try again shortly."
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});