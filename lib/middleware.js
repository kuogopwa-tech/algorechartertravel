import { createAppError } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_BYTES = 16 * 1024;

function getOrigin(req) {
  return req?.headers?.origin || req?.headers?.Origin || "";
}

function enforceOrigin(req) {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (configured.length === 0) return;

  const origin = getOrigin(req);
  if (!origin) return;

  if (!configured.includes(origin)) {
    throw createAppError("origin_not_allowed", { origin });
  }
}

function enforcePayloadSize(req, maxBytes = DEFAULT_MAX_BYTES) {
  const raw = req?.headers?.["content-length"] || req?.headers?.["Content-Length"];
  if (!raw) return;
  const size = Number(raw);
  if (!Number.isFinite(size)) return;
  if (size > maxBytes) {
    throw createAppError("payload_too_large", { maxBytes, size });
  }
}

function enforceJsonContentType(req) {
  const method = String(req?.method || "GET").toUpperCase();
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") return;

  const type = String(req?.headers?.["content-type"] || "").toLowerCase();
  if (!type.includes("application/json")) {
    throw createAppError("invalid_content_type");
  }
}

function createTimeoutGuard(timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timeoutId;
  let expired = false;

  const start = () =>
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        expired = true;
        reject(createAppError("request_timeout", { timeoutMs }));
      }, timeoutMs);
    });

  const clear = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  const isExpired = () => expired;

  return { start, clear, isExpired };
}

export {
  enforceOrigin,
  enforcePayloadSize,
  enforceJsonContentType,
  createTimeoutGuard
};
