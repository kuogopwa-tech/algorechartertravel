# Algore Charter Travels Website + AI Assistant

Premium Tours, Travel, and Recruitment website with a secure floating AI assistant.

## Architecture (Vercel-ready)
This project is configured for **static frontend + serverless backend**:

- Frontend: `index.html`
- Serverless API: `api/chat.js` and `api/health.js`
- Shared AI logic: `lib/blackbox.js`
- Vercel config: `vercel.json`

✅ No permanent backend server is required.
✅ No `server.listen()` runtime is used in production.

---

## 1) Environment Variables
Create a local `.env` file in project root (do **not** commit it):

```env
BLACKBOX_API_KEY=your_api_key
BLACKBOX_MODEL=blackboxai/openai/gpt-5.3-codex
BLACKBOX_BASE_URL=https://api.blackbox.ai
```

Template included as `env.example`.

> Note: In this environment, creating `.env.example` directly was restricted, so `env.example` is provided as the template.

---

## 2) Install Dependencies
```bash
npm install
```

---

## 3) Local Testing (Vercel serverless)
Run with Vercel dev server:

```bash
npm run dev
```

Open:
- `http://localhost:3000` (or the URL shown by Vercel CLI)

Health check:
- `GET /api/health`

Chat endpoint:
- `POST /api/chat`

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

## 6) Deploy to Vercel (Production)
1. Push project to GitHub.
2. Import the repo in Vercel.
3. In **Project Settings → Environment Variables**, add:
   - `BLACKBOX_API_KEY`
   - `BLACKBOX_MODEL`
   - `BLACKBOX_BASE_URL`
4. Deploy.

That’s it — no VPS, no process manager, no custom backend hosting.

---

## 7) Optional Netlify Note
For full serverless parity, use Netlify Functions equivalent for `/api/chat`.
Current setup is optimized for **Vercel serverless functions**.

---

## 8) Production Hardening (Recommended)
- Add rate limiting / abuse protection to `/api/chat`
- Add monitoring/logging for API errors
- Add content moderation / guardrails if needed
- Add caching for repeated FAQ prompts
