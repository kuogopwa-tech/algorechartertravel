# Deployment Diagnostics & Stabilization TODO

- [x] Fix invalid syntax artifacts in API handlers (`api/chat.js`, `api/test.js`, `api/health.js`)
- [x] Standardize module compatibility between API and shared lib (`lib/blackbox.js`)
- [x] Clean and align `package.json` scripts for local dev + Vercel compatibility
- [x] Re-apply minimal `vercel.json` runtime config after output-directory fix
- [x] Update `README.md` with exact Vercel dashboard settings (Framework: Other, Output Directory: empty)
- [x] Run syntax/config sanity checks
- [x] Final config verification summary for static root + `/api` serverless
