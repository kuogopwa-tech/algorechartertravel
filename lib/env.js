import { createAppError } from "./errors.js";

let validated = false;

function validateEnv() {
  if (validated) return;

  const required = ["BLACKBOX_API_KEY"];
  const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());

  if (missing.length) {
    throw createAppError("missing_required_env", { missing });
  }

  validated = true;
}

export { validateEnv };
