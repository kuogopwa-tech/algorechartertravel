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
  assertDomainAllowed,
  isGreetingMessage
} from "../lib/validate.js";

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

function getGreetingResponse() {
  return "Hello and welcome to Algore Charter Travels ✈️ How can I assist you today with travel, visas, holidays, or recruitment services?";
}

export default async function handler(req, res) {
  const ctx = createRequestContext(req);

  try {
    validateMethod(req, ["POST"]);
    res.setHeader("Allow", "POST");

    const rate = enforceRateLimit(req, { limit: 15, windowMs: 60_000 });
    res.setHeader("X-RateLimit-Limit", String(rate.limit));
    res.setHeader("X-RateLimit-Remaining", String(rate.remaining));

    const body = await parseJsonBody(req);
    const message = validateMessageInput(body?.message);
    const history = validateHistory(body?.history);

    assertNoPromptInjection(message);

    // Explicit greeting short-circuit path BEFORE domain restrictions and provider calls.
    // This guarantees openers never fall into non_domain_request.
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

      return sendNormalized(
        res,
        200,
        normalizedSuccess({
          requestId: ctx.requestId,
          source: "controlled_greeting",
          answer: getGreetingResponse()
        }),
        ctx.requestId
      );
    }

    assertDomainAllowed(message);

    const reply = await callBlackboxAI({
      userMessage: message,
      history
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

    return sendNormalized(
      res,
      status,
      normalizedFailure({
        requestId: ctx.requestId,
        source,
        code: err.code,
        message: err.message
      }),
      ctx.requestId
    );
  }
}
