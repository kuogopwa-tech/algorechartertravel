const ERROR_CATALOG = {
  invalid_method: { status: 405, code: "invalid_method", message: "Method Not Allowed" },
  invalid_json: { status: 400, code: "invalid_json", message: "Invalid JSON body." },
  invalid_content_type: { status: 415, code: "invalid_content_type", message: "Content-Type must be application/json." },
  payload_too_large: { status: 413, code: "payload_too_large", message: "Payload exceeds allowed size." },
  request_timeout: { status: 408, code: "request_timeout", message: "Request timed out." },
  origin_not_allowed: { status: 403, code: "origin_not_allowed", message: "Request origin not allowed." },
  missing_required_env: { status: 500, code: "missing_required_env", message: "Server environment is not configured." },
  invalid_payload: { status: 400, code: "invalid_payload", message: "Invalid request payload." },
  invalid_message: { status: 400, code: "invalid_message", message: "Please enter a valid message." },
  message_too_long: { status: 400, code: "message_too_long", message: "Message exceeds allowed length." },
  prompt_injection_blocked: { status: 400, code: "prompt_injection_blocked", message: "Request blocked by safety policy." },
  non_domain_request: { status: 400, code: "non_domain_request", message: "😄 Mimi huku ni wa travel matters only. Nikusaidie holiday destination, visa plan, safari, or recruitment options?" },
  rate_limited: { status: 429, code: "rate_limited", message: "Too many requests. Please wait and try again." },
  missing_blackbox_api_key: { status: 500, code: "missing_blackbox_api_key", message: "Assistant configuration is incomplete." },
  missing_blackbox_base_url: { status: 500, code: "missing_blackbox_base_url", message: "Assistant configuration is incomplete." },
  provider_auth_error: { status: 502, code: "provider_auth_error", message: "AI provider authentication failed." },
  provider_rate_limited: { status: 503, code: "provider_rate_limited", message: "AI provider is busy. Try again shortly." },
  provider_unavailable: { status: 503, code: "provider_unavailable", message: "AI provider unavailable. Try again shortly." },
  provider_invalid_json: { status: 502, code: "provider_invalid_json", message: "Invalid AI provider response." },
  provider_invalid_shape: { status: 502, code: "provider_invalid_shape", message: "Malformed AI provider response." },
  provider_timeout: { status: 504, code: "provider_timeout", message: "AI provider timed out." },
  unverified_response: { status: 502, code: "unverified_response", message: "I could not find verified information." },
  internal_error: { status: 500, code: "internal_error", message: "Unexpected server error." }
};

function createAppError(code, meta = {}) {
  const base = ERROR_CATALOG[code] || ERROR_CATALOG.internal_error;
  const err = new Error(base.message);
  err.code = base.code;
  err.status = base.status;
  err.meta = meta;
  return err;
}

function normalizeError(error) {
  if (!error) return createAppError("internal_error");
  if (error.code && ERROR_CATALOG[error.code]) return error;
  if (error.message && ERROR_CATALOG[error.message]) return createAppError(error.message, error.meta || {});
  return createAppError("internal_error");
}

function sanitizeErrorForLog(error) {
  return {
    code: error?.code || "internal_error",
    status: error?.status || 500,
    message: error?.message || "Unexpected server error.",
    meta: error?.meta ? JSON.parse(JSON.stringify(error.meta)) : undefined
  };
}

export { ERROR_CATALOG, createAppError, normalizeError, sanitizeErrorForLog };
