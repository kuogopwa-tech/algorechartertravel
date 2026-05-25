# Algore Charter Travels Website + AI Assistant

This project is a premium Tours, Travel, and Recruitment website with a secure floating AI chat assistant powered by Blackbox AI.

## 1) Environment variables
Create a local `.env` file in the project root (do **not** commit it):

```env
BLACKBOX_API_KEY=your_api_key
BLACKBOX_MODEL=blackboxai/openai/gpt-5.3-codex
BLACKBOX_BASE_URL=https://api.blackbox.ai
PORT=3000
```

A template file is included as `env.example`.

## 2) Install dependencies
```bash
npm install
```

## 3) Run locally
```bash
npm run dev
```
Open:
- `http://localhost:3000`

## 4) Security notes
- API key is used only on backend (`server.js` + `lib/blackbox.js`).
- Frontend never exposes `BLACKBOX_API_KEY`.

## 5) API route
- `POST /api/chat`
- Body:
```json
{
  "message": "I want to book a trip to Qatar",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello!" }
  ]
}
```

## 6) Deploy

### Vercel
1. Push repo to GitHub.
2. Import project in Vercel.
3. Add env vars in **Project Settings > Environment Variables**:
   - `BLACKBOX_API_KEY`
   - `BLACKBOX_MODEL`
   - `BLACKBOX_BASE_URL`
   - `PORT` (optional)
4. Deploy.

### Netlify
Use Netlify with a Node backend (or separate backend service).
1. Add environment variables in Site settings.
2. Ensure Node server runtime is configured for backend endpoints.
3. Deploy.

> If using static-only Netlify hosting, host `server.js` API on another backend (Render/Railway/Fly.io) and update frontend fetch URL accordingly.

## 7) Production tips
- Add request rate limiting for `/api/chat`.
- Add logging/monitoring and error tracking.
- Optionally add caching for repeated questions.
