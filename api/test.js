import { normalizeError, sanitizeErrorForLog } from "../lib/errors.js";
import { createRequestContext, success, failure, logRequest } from "../lib/response.js";

export default async function handler(req, res) {
  const ctx = createRequestContext(req);

  try {
    const latencyMs = Date.now() - ctx.start;

    logRequest({
      requestId: ctx.requestId,
      route: "/api/test",
      method: req.method,
      status: 200,
      latencyMs
    });

    return success(res, ctx.requestId, { status: "working" }, 200);
  } catch (rawError) {
    const err = normalizeError(rawError);
    const latencyMs = Date.now() - ctx.start;

    logRequest({
      requestId: ctx.requestId,
      route: "/api/test",
      method: req.method,
      status: err.status || 500,
      latencyMs,
      error: sanitizeErrorForLog(err)
    });

    return failure(res, ctx.requestId, err);
  }
}
