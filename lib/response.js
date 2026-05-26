import crypto from "node:crypto";

function createRequestContext(req) {
  const start = Date.now();
  const requestId = req?.headers?.["x-request-id"] || crypto.randomUUID();
  return {
    requestId,
    start,
    route: req?.url || "unknown",
    method: req?.method || "UNKNOWN"
  };
}

function json(res, status, payload, requestId) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Request-Id", requestId);
  return res.status(status).json(payload);
}

function success(res, requestId, data = {}, status = 200) {
  return json(res, status, { ok: true, requestId, ...data }, requestId);
}

function failure(res, requestId, error) {
  return json(
    res,
    error.status || 500,
    {
      ok: false,
      requestId,
      error: {
        code: error.code || "internal_error",
        message: error.message || "Unexpected server error."
      }
    },
    requestId
  );
}

function logRequest({ requestId, route, method, status, latencyMs, error }) {
  const base = { requestId, route, method, status, latencyMs };
  if (error) {
    console.error("[api]", { ...base, error });
    return;
  }
  console.info("[api]", base);
}

export { createRequestContext, success, failure, logRequest };
