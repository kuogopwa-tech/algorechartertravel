import { createAppError } from "./errors.js";

const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function enforceRateLimit(req, { limit = 20, windowMs = 60_000 } = {}) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(ip, { start: now, count: 1 });
    return { ip, remaining: limit - 1, limit };
  }

  if (bucket.count >= limit) {
    throw createAppError("rate_limited", { ip, limit, windowMs });
  }

  bucket.count += 1;
  buckets.set(ip, bucket);
  return { ip, remaining: limit - bucket.count, limit };
}

export { getClientIp, enforceRateLimit };
