// chat.js - Complete fixed version

import { callBlackboxAI } from "../lib/blackbox.js";
import { createAppError, normalizeError, sanitizeErrorForLog } from "../lib/errors.js";
import { createRequestContext, logRequest } from "../lib/response.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import {
  parseJsonBody,
  validateMethod,
  validateMessageInput,
  validateHistory,
  assertNoPromptInjection,
  isGreetingMessage,
  detectLanguage,
  isTravelRelated
} from "../lib/validate.js";

// Store session context to track user sessions
const sessionContext = new Map();

function sendNormalized(res, status, payload, requestId) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Request-Id", requestId);
  return res.status(status).json(payload);
}

function normalizedSuccess({ requestId, source, answer }) {
  return {
    ok: true,
    requestId,
    source: source || "web_verified",
    answer,
    error: null
  };
}

function normalizedFailure({ requestId, source, code, message }) {
  return {
    ok: false,
    requestId,
    source: source || "controlled_fallback",
    answer: null,
    error: {
      code: code || "internal_error",
      message: message || "Unexpected server error."
    }
  };
}

function getGreetingResponse(lang = "en") {
  const greetings = {
    en: "Good morning and Karibu to Algore Charter Travels ✈️ I'm your travel concierge. I can help with Dubai packages, visa assistance, holiday destinations, and safari bookings.",
    sw: "Habari ya asubuhi na Karibu Algore Charter Travels ✈️ Mimi ni travel concierge wako. Naweza kusaidia na paket za Dubai, msaada wa visa, destinations za likizo, na booking za safari.",
    fr: "Bonjour et Karibu à Algore Charter Travels ✈️ Je suis votre concierge de voyage. Je peux vous aider avec les forfaits Dubai, l'assistance visa, les destinations de vacances et les réservations de safari."
  };
  return greetings[lang] || greetings.en;
}

// Check if message is a complaint
function isComplaint(message) {
  const lowerMsg = message.toLowerCase();
  const complaintPatterns = [
    'sio mzuri', 'not good', 'not friendly', 'not helpful', 'hunisaidii',
    'huongei', 'you are not', 'you aren\'t', 'bad service', 'poor service',
    'sio poa', 'mbaya', 'fala', 'useless'
  ];
  return complaintPatterns.some(pattern => lowerMsg.includes(pattern));
}

function getSessionKey(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  return `${ip}_${userAgent.substring(0, 50)}`;
}

// Handle complaint responses - apologetic and helpful
async function handleComplaint(userMessage, lang, session) {
  const lowerMsg = userMessage.toLowerCase();
  
  session.hasComplained = true;
  
  const responses = {
    en: "😊 I'm really sorry you feel that way. You're absolutely right to expect better. Let me make it right - what travel service can I help you with right now? Visa, flight, hotel, or package? I promise to give you my full attention. ✈️",
    sw: "😊 Samahani sana kama umekasirika. Uko sahihi kutarajia bora zaidi. Nirekebishe - unahitaji huduma gani ya safari sasa hivi? Visa, ndege, hoteli, au package? Naahidi kukusaidia vizuri. ✈️",
    fr: "😊 Je suis vraiment désolé que vous vous sentiez ainsi. Vous avez raison d'attendre mieux. Laissez-moi arranger ça - de quel service de voyage avez-vous besoin maintenant? Visa, vol, hôtel ou forfait? Je promets de vous donner toute mon attention. ✈️"
  };
  
  return responses[lang] || responses.en;
}

// Generate redirect for off-topic messages
async function getRedirectResponse(userMessage, lang, redirectCount) {
  const lowerMsg = userMessage.toLowerCase();
  
  const redirects = {
    en: "I'm here to help with your travel needs! Tell me about your trip - where, when, and how many people? ✈️",
    sw: "Niko hapa kusaidia na safari zako! Niambie kuhusu safari yako - wapi, lini, na watu wangapi? ✈️",
    fr: "Je suis là pour vous aider avec vos voyages! Parlez-moi de votre voyage - où, quand et combien de personnes? ✈️"
  };
  
  return redirects[lang] || redirects.en;
}

export default async function handler(req, res) {
  const ctx = createRequestContext(req);
  let userLang = "en";
  let originalMessage = "";
  
  const sessionId = getSessionKey(req);
  let session = sessionContext.get(sessionId);
  if (!session) {
    session = { 
      redirectCount: 0, 
      lastMessage: '', 
      timestamp: Date.now(), 
      name: null, 
      hasComplained: false 
    };
    sessionContext.set(sessionId, session);
  }
  
  // Clean up old sessions (older than 30 minutes)
  for (const [key, sess] of sessionContext.entries()) {
    if (Date.now() - sess.timestamp > 30 * 60 * 1000) {
      sessionContext.delete(key);
    }
  }

  try {
    validateMethod(req, ["POST"]);
    res.setHeader("Allow", "POST");

    const rate = enforceRateLimit(req, { limit: 15, windowMs: 60_000 });
    res.setHeader("X-RateLimit-Limit", String(rate.limit));
    res.setHeader("X-RateLimit-Remaining", String(rate.remaining));

    const body = await parseJsonBody(req);
    const message = validateMessageInput(body?.message);
    const history = validateHistory(body?.history);
    originalMessage = message;
    
    session.timestamp = Date.now();
    session.lastMessage = message;

    if (message) {
      userLang = detectLanguage(message);
      
      // Extract name if introduced
      if (!session.name && (message.toLowerCase().includes('naitwa') || message.toLowerCase().includes('jina langu'))) {
        const nameMatch = message.match(/(?:naitwa|jina langu|ninaitwa)\s+(\w+)/i);
        if (nameMatch) session.name = nameMatch[1];
      }
    }

    assertNoPromptInjection(message);

    // Handle complaints FIRST - before anything else
    if (isComplaint(message)) {
      const complaintResponse = await handleComplaint(message, userLang, session);
      session.redirectCount = 0;
      
      const latencyMs = Date.now() - ctx.start;
      logRequest({
        requestId: ctx.requestId,
        route: "/api/chat",
        method: req.method,
        status: 200,
        latencyMs
      });

      return sendNormalized(
        res,
        200,
        normalizedSuccess({
          requestId: ctx.requestId,
          source: "complaint_response",
          answer: complaintResponse
        }),
        ctx.requestId
      );
    }

    const isGreetingOnly = isGreetingMessage(message);
    if (isGreetingOnly) {
      const latencyMs = Date.now() - ctx.start;
      logRequest({
        requestId: ctx.requestId,
        route: "/api/chat",
        method: req.method,
        status: 200,
        latencyMs
      });

      let greeting = getGreetingResponse(userLang);
      if (session.name) {
        greeting = `Good morning ${session.name}! ${greeting}`;
      }
      
      return sendNormalized(
        res,
        200,
        normalizedSuccess({
          requestId: ctx.requestId,
          source: "controlled_greeting",
          answer: greeting
        }),
        ctx.requestId
      );
    }

    // Check if message is travel-related using isTravelRelated
    const travelRelated = isTravelRelated(message);
    
    // If NOT travel-related, redirect briefly
    if (!travelRelated) {
      session.redirectCount++;
      
      const redirectResponse = await getRedirectResponse(message, userLang, session.redirectCount);
      
      const latencyMs = Date.now() - ctx.start;
      logRequest({
        requestId: ctx.requestId,
        route: "/api/chat",
        method: req.method,
        status: 200,
        latencyMs
      });

      return sendNormalized(
        res,
        200,
        normalizedSuccess({
          requestId: ctx.requestId,
          source: "redirect",
          answer: redirectResponse
        }),
        ctx.requestId
      );
    }
    
    // Travel-related - reset redirect counter and handle travel query
    if (travelRelated && !isGreetingOnly) {
      session.redirectCount = 0;
    }

    // Build system prompt for travel AI
    let personalNote = session.name ? `The user's name is ${session.name}. Use it naturally. ` : '';
    if (session.hasComplained) {
      personalNote += `The user previously complained about poor service. Be EXTRA helpful, apologize once briefly at the start if needed, then focus entirely on solving their travel request. Make them feel valued and heard. `;
    }
    
    const reply = await callBlackboxAI({
      userMessage: message,
      history,
      systemPrompt: `You are a warm, professional travel concierge for Algore Charter Travels, a Kenyan travel agency.

${personalNote}

YOUR SERVICES:
- Dubai packages, visa assistance, holiday destinations, safari bookings
- Mombasa, Diani, Zanzibar, Dubai, Qatar, India visa
- Flight and hotel bookings, group packages, recruitment services
- Transport options: car (gari) or plane (ndege) depending on route

RULES:
1. ALWAYS answer travel questions directly and helpfully
2. If user asks about visas: Ask which country, travel dates, explain requirements and processing time
3. If user asks about packages: Ask destination, dates, number of people, then give options with rough pricing
4. If user asks about transport (gari/ndege): Explain pros and cons of each
5. For contacts: Share +254700070014 and info@algorechartertravels.com
6. For application/process questions: Guide them step by step
7. Use Swahili naturally: poa, sawa, karibu, asante, ndiyo, hapana
8. Be warm, helpful, and EFFICIENT - focus on solving their travel needs
9. If user says "let's start application" or "nipangie" - engage directly with the process

CONTACT INFO TO SHARE IF ASKED:
📞 Phone/WhatsApp: +254700070014
📧 Email: info@algorechartertravels.com

IMPORTANT: ALWAYS answer travel questions. DO NOT redirect travel questions. Be helpful and thorough. ✈️`
    });

    if (!reply || typeof reply !== "string" || !reply.trim()) {
      throw createAppError("provider_invalid_shape");
    }

    const latencyMs = Date.now() - ctx.start;
    logRequest({
      requestId: ctx.requestId,
      route: "/api/chat",
      method: req.method,
      status: 200,
      latencyMs
    });

    return sendNormalized(
      res,
      200,
      normalizedSuccess({
        requestId: ctx.requestId,
        source: "web_verified",
        answer: reply.trim()
      }),
      ctx.requestId
    );
  } catch (rawError) {
    const err = normalizeError(rawError);
    const latencyMs = Date.now() - ctx.start;

    logRequest({
      requestId: ctx.requestId,
      route: "/api/chat",
      method: req.method,
      status: err.status || 500,
      latencyMs,
      error: sanitizeErrorForLog(err)
    });

    if (err.code === "invalid_method") {
      res.setHeader("Allow", "POST");
    }

    const status = err.status || 500;
    const source =
      err.code === "provider_timeout" ||
      err.code === "provider_unavailable" ||
      err.code === "provider_invalid_json" ||
      err.code === "provider_invalid_shape" ||
      err.code === "provider_rate_limited"
        ? "upstream_failure"
        : "controlled_fallback";

    let finalMessage = err.message;
    if (err.code === "non_domain_request") {
      finalMessage = "😊 Let me help you with your travel plans. Where would you like to go? ✈️";
    }

    return sendNormalized(
      res,
      status,
      normalizedFailure({
        requestId: ctx.requestId,
        source,
        code: err.code,
        message: finalMessage
      }),
      ctx.requestId
    );
  }
}