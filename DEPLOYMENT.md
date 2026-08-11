# Deployment Guide: Algore Charter Travels

## Overview
This project uses Vercel serverless functions for AI chat integration with dual provider support (Google Gemini and Blackbox AI). Both local development and Vercel deployment are fully supported.

## Local Development Setup

### Prerequisites
- Node.js 20.x or higher
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Create local environment file
cp env.example .env

# Edit .env with your API keys
nano .env
```

### Running Locally
```bash
# Start local dev server on http://localhost:3000
npm run dev

# Or use Vercel CLI (if installed globally)
npm run dev:vercel
```

The local server will serve:
- Static files (HTML, CSS, JS) from the project root
- API routes from `/api` directory

## Environment Variables

### Required Variables
- `GEMINI_API_KEY`: Google Gemini API key from https://aistudio.google.com/app/apikey

### Optional Variables
```
AI_PROVIDER=gemini              # Active AI provider
GEMINI_MODEL=gemini-flash-latest   # Gemini model to use
PORT=3000                       # Local dev server port
NODE_ENV=production             # For Vercel builds
```

## Vercel Deployment

### Step 1: Connect Repository
1. Push your code to GitHub: `git push origin main`
2. Go to https://vercel.com
3. Click "New Project"
4. Select your GitHub repository
5. Click "Import"

### Step 2: Configure Environment Variables
**IMPORTANT**: Do NOT commit `.env` file to GitHub. Set variables in Vercel dashboard:

1. After importing, click "Environment Variables" in the project settings
2. Add each variable from `.env` **without quotes**:

**Example Configuration:**
```
AI_PROVIDER                    gemini
GEMINI_API_KEY                 your_gemini_api_key
GEMINI_MODEL                   gemini-flash-latest
NODE_ENV                       production
```

### Step 3: Deploy
1. Vercel automatically detects the build configuration from `vercel.json`
2. Click "Deploy" button
3. Wait for build to complete
4. Your app will be live at `https://your-project-name.vercel.app`

### Step 4: Verify Deployment
1. Test the chat API endpoint: `POST /api/chat`
2. Send test request:
```bash
curl -X POST https://your-project-name.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

Expected response:
```json
{
  "ok": true,
  "requestId": "uuid-here",
  "source": "controlled_greeting",
  "answer": "Good morning and Karibu...",
  "error": null
}
```

## Provider Fallback System

### How It Works
- **Primary Provider**: Set via `AI_PROVIDER` environment variable
- **Fallback Provider**: Automatically used if primary fails
- **Automatic Retry**: Failed requests retry up to 2 times with exponential backoff
- **Smart Error Handling**:
  - Timeout errors (25 seconds): Retry once
  - Rate limit errors (429): Retry with 2-4 second delay
  - Auth errors (401/403): Fail immediately (no retry)

### Example Scenarios

**Scenario 1: Gemini Timeout → Blackbox**
```
1. Gemini request times out (>25 seconds)
2. Automatically falls back to Blackbox
3. Blackbox responds successfully
4. User gets response with source: "web_verified"
```

**Scenario 2: Blackbox Rate Limited → Gemini**
```
1. Blackbox returns 429 (rate limited)
2. Retries Blackbox after 2-4 second delay
3. If still fails, falls back to Gemini
4. Gemini processes request
```

**Scenario 3: Both Providers Unavailable**
```
1. Primary provider fails
2. Fallback provider also fails
3. Server returns 503 with user-friendly error
4. Response: "AI service is temporarily unavailable. Please try again shortly."
```

## API Keys Security

### For Local Development
- Store keys in `.env` file (never commit to git)
- `.env` is in `.gitignore` by default
- Keys are loaded at server startup

### For Vercel Production
- **NEVER commit `.env` file to GitHub**
- Use Vercel Dashboard → Project Settings → Environment Variables
- Keys are encrypted at rest in Vercel
- Keys are only injected at build time and runtime
- Never appear in logs or source code
- Can be rotated without redeployment by updating dashboard

### Getting API Keys

**Google Gemini:**
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Select or create a Google Cloud project
4. Copy the API key
5. Paste into `GEMINI_API_KEY` environment variable

**Blackbox AI:**
1. Go to https://www.blackbox.ai/
2. Sign up or login
3. Navigate to API settings
4. Generate API key
5. Paste into `BLACKBOX_API_KEY` environment variable

## Troubleshooting

### "Missing GEMINI_API_KEY or BLACKBOX_API_KEY" Error
**Solution**: Ensure at least one API key is configured:
```bash
# Local: Add to .env
GEMINI_API_KEY=your_key_here

# Vercel: Add to Environment Variables in Dashboard
```

### Vercel Deployment Fails
**Check:**
1. Node.js version: `vercel.json` specifies 20.x
2. Environment variables are set (not secrets)
3. No `.env` file committed to GitHub
4. Build logs for specific errors

**View logs:**
```bash
vercel logs https://your-project-name.vercel.app
```

### Chat Endpoint Returns 503
**Cause**: Both providers failed
**Solution**:
1. Verify both API keys are valid (test directly if possible)
2. Check provider status pages (Google, Blackbox)
3. View server logs for specific error details

### Slow Responses
**Optimization**:
1. Check provider response times (target <5 seconds)
2. Consider switching primary provider if one is slower
3. Increase timeout threshold in `lib/provider.js` if needed

## API Endpoints

### POST /api/chat
Main chat endpoint with AI provider integration.

**Request:**
```json
{
  "message": "Tell me about Dubai trips",
  "history": [
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "assistant",
      "content": "Hello! How can I help?"
    }
  ]
}
```

**Response Success (200):**
```json
{
  "ok": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "source": "web_verified",
  "answer": "Dubai offers amazing travel packages...",
  "error": null
}
```

**Response Error (5xx):**
```json
{
  "ok": false,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "source": "upstream_failure",
  "answer": null,
  "error": {
    "code": "provider_unavailable",
    "message": "AI service is temporarily unavailable. Please try again shortly."
  }
}
```

## Rate Limiting
- **Limit**: 15 requests per minute per IP
- **Headers**: Response includes `X-RateLimit-Limit` and `X-RateLimit-Remaining`
- **Response on Limit**: 429 status with "Too many requests" error

## Performance Considerations

- **Request Timeout**: 25 seconds per AI provider call
- **Response Size**: Limited to 2048 tokens (~2000 words)
- **Max Message Length**: 1000 characters per user message
- **Chat History**: Last 10 messages kept for context
- **Session Storage**: In-memory (cleared after 30 minutes of inactivity)

## Next Steps

1. **Configure Environment**: Set API keys in Vercel dashboard
2. **Deploy**: Push to main branch or click Deploy in Vercel dashboard
3. **Test**: Call `/api/chat` endpoint with test message
4. **Monitor**: Check Vercel Analytics for performance metrics
5. **Update**: Modify AI provider or models as needed

## Support

For issues or questions:
- Check troubleshooting section above
- Review Vercel documentation: https://vercel.com/docs
- Visit provider documentation:
  - Gemini: https://ai.google.dev/docs
  - Blackbox: https://www.blackbox.ai/docs
