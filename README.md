# Algore Charter Travels Website + AI Assistant

Premium Tours, Travel, and Recruitment website with a secure floating AI assistant.

## Architecture (Vercel-ready)
This project is configured for **static frontend + serverless backend**:

- Frontend: `index.html`
- Serverless API: `api/chat.js` and `api/health.js`
- Shared AI logic: `lib/blackbox.js`
- Vercel config: `vercel.json`

? No permanent backend server is required.
? No `server.listen()` runtime is used in production.

---

## 1) Environment Variables
Create a local `.env` file in project root (do **not** commit it):

```env
BLACKBOX_API_KEY=your_api_key
BLACKBOX_MODEL=blackboxai/openai/gpt-5.3-codex
BLACKBOX_BASE_URL=https://api.blackbox.ai
```

Template included as `.env.example`.

---

## 2) Install Dependencies
```bash
npm install
```

---

## 3) Local Development Workflow
Run local static + API testing:

```bash
npm run dev
```

This starts `local-dev-server.js`, serves `index.html`, and proxies `/api/*` to the same handlers used in production.

Open:
- `http://localhost:3000`

Alternative (Vercel simulation):

```bash
npm run dev:vercel
```

---

## 4) API Contract
### `POST /api/chat`
Request body:
```json
{
  "message": "I want to book a trip to Qatar",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello!" }
  ]
}
```

Response:
```json
{
  "reply": "..."
}
```

---

## 5) Security
- `BLACKBOX_API_KEY` is read only in serverless function runtime.
- Frontend calls `/api/chat` and never stores secrets.
- Input is validated and empty messages are rejected.

---

## 6) Scripts
- `npm run dev` -> local static + `/api` testing (easy localhost workflow)
- `npm run dev:vercel` -> run Vercel local runtime (`vercel dev`)
- `npm run build` -> build placeholder for static + serverless deployment
- `npm run start` -> local static + `/api` testing via `local-dev-server.js`

---

## 7) Deploy to Vercel (Production)
1. Push project to GitHub.
2. Import the repo in Vercel.
3. In **Project Settings -> Build & Output Settings** set:
   - **Framework Preset:** `Other`
   - **Root Directory:** repository root
   - **Output Directory:** **leave empty**
   - **Install Command:** default
   - **Build Command:** default (or keep `npm run build` as static placeholder)
4. In **Project Settings -> Environment Variables**, add:
   - `BLACKBOX_API_KEY`
   - `BLACKBOX_MODEL`
   - `BLACKBOX_BASE_URL`
5. Deploy.

That’s it — no VPS, no process manager, no custom backend hosting.

### Why “No Output Directory named 'public' found” happened
That error is caused by Vercel dashboard config expecting a framework-style build output folder (`public`) that does not exist in this repo.  
This project serves `index.html` directly from repository root and uses `/api/*.js` serverless functions, so **Output Directory must be empty**.

---

## 8) Optional Netlify Note
For full serverless parity, use Netlify Functions equivalent for `/api/chat`.
Current setup is optimized for **Vercel serverless functions**.

---

## 9) Deployment Diagnostics & Stabilization Checklist

### Root causes of repeated instant (1-4s) Vercel failures
1. **Invalid JavaScript tokens in API handlers**  
   `api/chat.js`, `api/test.js`, and `api/health.js` had trailing invalid characters (`` `n `` artifacts), causing immediate parse errors before build/runtime setup.
2. **Module-format instability risk**  
   API handlers use `export default` while shared utility uses CommonJS (`require/module.exports`). This can be brittle in some setups, so the current repository is kept consistently compatible with its existing local runtime and Vercel Node serverless behavior.
3. **Script/documentation mismatch**  
   README script descriptions were inconsistent with `package.json`, causing confusion during local and Vercel-like validation workflows.

### Verified Vercel compatibility state
- `vercel.json` is minimal and modern:
  - `functions.api/**/*.js.runtime = nodejs20.x`
- API route files exist and are correctly structured:
  - `/api/chat.js`
  - `/api/test.js`
  - `/api/health.js`
- Each API file exports default handler:
  - `export default async function handler(req, res) {}`
- `package.json` contains Node engine:
  - `"engines": { "node": "20.x" }`
- No deprecated `builds`, `routes`, or legacy runtime blocks in `vercel.json`.

### Pre-deploy checks
- Validate JSON syntax:
  - `package.json`
  - `vercel.json`
- Ensure no hidden Unicode or invalid trailing characters in API files.
- Confirm required env vars in Vercel Project Settings:
  - `BLACKBOX_API_KEY`
  - `BLACKBOX_MODEL`
  - `BLACKBOX_BASE_URL`
- Confirm frontend is static (`index.html`) and does not rely on custom backend server in production.
- Confirm `/api/health` and `/api/test` return success after deploy.

## 10) Production Hardening (Recommended)
- Keep rate limiting / abuse protection on `/api/chat`
- Add monitoring/logging for API errors
- Add content moderation / guardrails if needed
- Add caching for repeated FAQ prompts

