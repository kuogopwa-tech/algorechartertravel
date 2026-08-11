# AI Integration Documentation

## Overview

This project integrates dual AI providers (Google Gemini and Blackbox AI) for travel chatbot functionality. The system automatically switches between providers if the primary fails, ensuring high availability and reliability.

## Features

### ✅ Dual AI Provider Support
- **Primary Provider**: Configurable via `AI_PROVIDER` environment variable
- **Fallback System**: Automatically switches to alternate provider if primary fails
- **Smart Retry**: Implements exponential backoff for transient failures
- **Provider-Specific**: Each provider has optimized configuration

### ✅ Robust Error Handling
- **Timeout Handling**: 25-second timeout per request with automatic fallback
- **Rate Limit Management**: Automatic retry with exponential backoff for 429 responses
- **Authentication Errors**: Immediate failure (no retry) for 401/403 errors
- **Graceful Degradation**: User-friendly error messages with fallback responses

### ✅ Session Management
- **User Context**: Tracks session state (name, complaint history, redirect count)
- **Session Cleanup**: Automatic purge of inactive sessions after 30 minutes
- **Per-IP Tracking**: Maintains separate sessions for different clients

### ✅ Content Safety
- **Prompt Injection Prevention**: Blocks common jailbreak patterns
- **Safety Policies**: Respects provider safety guidelines
- **Domain Validation**: Ensures responses are travel-related
- **Rate Limiting**: 15 requests per minute per IP address

### ✅ Language Support
- **Multi-Language Detection**: Automatically detects Swahili, French, Spanish, Arabic, English
- **Localized Responses**: Provides responses in detected user language
- **Fallback to English**: Defaults to English if language detection fails

### ✅ Travel-Specific Features
- **Travel Context Awareness**: Understands travel-related queries
- **Complaint Handling**: Special responses for unsatisfied users
- **Greeting Recognition**: Natural greeting detection
- **Off-Topic Redirect**: Gently redirects non-travel queries

## Architecture

### File Structure

```
algorechartertravel/
├── api/
│   ├── chat.js                 # Main chat endpoint (POST /api/chat)
│   ├── chat-gemini.js          # Legacy Gemini endpoint (backup)
│   ├── health.js               # Health check endpoint
│   └── test.js                 # Test endpoint
├── lib/
│   ├── gemini.js               # Google Gemini API integration
│   ├── blackbox.js             # Blackbox AI API integration
│   ├── provider.js             # Provider manager & fallback logic
│   ├── env.js                  # Environment validation
│   ├── errors.js               # Error definitions & handling
│   ├── response.js             # Response formatting utilities
│   ├── rateLimit.js            # Rate limiting middleware
│   ├── validate.js             # Input validation & sanitation
│   ├── travelKeywords.js       # Travel-related keyword list
│   └── middleware.js           # Middleware utilities
├── env.example                 # Environment variables template
├── package.json                # Project dependencies
├── vercel.json                 # Vercel deployment config
├── local-dev-server.cjs        # Local development server
├── DEPLOYMENT.md               # Vercel deployment guide
└── README.md                   # Project documentation
```

### Provider System

#### Provider Manager (`lib/provider.js`)
```javascript
callAI(params, options) // Main function with automatic fallback
validateProviders()      // Validates at least one provider is configured
getProviderInfo()        // Returns current provider configuration
```

#### Gemini Service (`lib/gemini.js`)
- Uses `@google/generative-ai` library
- Implements Google's generative model API
- Configurable model (default: `gemini-flash-latest`)
- Handles prompt blocking gracefully

#### Blackbox Service (`lib/blackbox.js`)
- REST API integration with OpenAI-compatible format
- Configurable model and base URL
- Standard chat completion format
- Full error handling and retries

## Configuration

### Environment Variables

**Required:**
```bash
# Google Gemini
GEMINI_API_KEY=your_api_key_from_aistudio.google.com
```

**Optional:**
```bash
# Active provider
AI_PROVIDER=gemini

# Model configurations
GEMINI_MODEL=gemini-flash-latest

# Server
PORT=3000
NODE_ENV=production
```

### Getting API Keys

**Google Gemini:**
1. Visit https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Select or create a Google Cloud project
4. Copy the generated API key
5. Add to `GEMINI_API_KEY` environment variable

## Local Development

### Setup

```bash
# Install dependencies
npm install

# Create .env file from template
cp env.example .env

# Edit .env with your API keys
nano .env  # (or your preferred editor)
```

### Running

```bash
# Start local dev server
npm run dev

# Server runs on http://localhost:3000
# API endpoint: POST http://localhost:3000/api/chat
```

### Testing the Chat Endpoint

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about Dubai trips",
    "history": []
  }'
```

Expected response:
```json
{
  "ok": true,
  "requestId": "abc-123-def-456",
  "source": "web_verified",
  "answer": "Dubai offers amazing travel packages...",
  "error": null
}
```

## Deployment

### Vercel Deployment

See `DEPLOYMENT.md` for detailed instructions.

Quick steps:
1. Push code to GitHub
2. Import repository in Vercel dashboard
3. Add environment variables in Vercel project settings (NOT `.env` file)
4. Deploy automatically or manually
5. Test `/api/chat` endpoint on Vercel domain

### Environment Variables in Vercel

**DO NOT commit `.env` file to GitHub!**

Set variables in Vercel Dashboard:
- Project Settings → Environment Variables
- Add each variable separately without quotes
- Variables are encrypted at rest
- Injected at build and runtime only

## API Reference

### POST /api/chat

Main chat endpoint with AI provider integration.

**Request:**
```json
{
  "message": "Hello, I want to travel to Dubai",
  "history": [
    {
      "role": "user",
      "content": "Hi there"
    },
    {
      "role": "assistant",
      "content": "Hello! How can I help?"
    }
  ]
}
```

**Request Parameters:**
- `message` (string, required): User's message (max 1000 chars)
- `history` (array, optional): Previous messages (max 10 items)
  - Each item: `{ role: "user"|"assistant", content: string }`

**Response Success (200):**
```json
{
  "ok": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "source": "web_verified",
  "answer": "Dubai is a great destination...",
  "error": null
}
```

**Response Error (varies):**
```json
{
  "ok": false,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "source": "upstream_failure",
  "answer": null,
  "error": {
    "code": "provider_timeout",
    "message": "AI provider timed out."
  }
}
```

**Response Sources:**
- `web_verified`: Response from AI provider (success)
- `controlled_greeting`: Greeting detection (no provider call)
- `complaint_response`: Complaint handling (no provider call)
- `redirect`: Off-topic redirect (no provider call)
- `upstream_failure`: Provider error (provider failed)
- `controlled_fallback`: System error (no provider called)

**Status Codes:**
- `200`: Successful response (check `ok` field)
- `400`: Invalid request (bad message, prompt injection, etc.)
- `408`: Request timeout
- `429`: Rate limited (15 requests/minute/IP)
- `500`: Server error (missing env vars, etc.)
- `502`: Provider error (invalid response shape, etc.)
- `503`: Provider unavailable (both providers failed)
- `504`: Provider timeout

**Response Headers:**
- `X-Request-Id`: Unique request identifier
- `X-RateLimit-Limit`: Rate limit per minute (15)
- `X-RateLimit-Remaining`: Remaining requests this minute
- `Cache-Control`: no-store (never cache)

## Performance

### Response Times
- **Target**: < 5 seconds per response
- **Timeout**: 25 seconds per provider call
- **Retry**: 2 attempts maximum
- **Fallback**: < 10 seconds additional if first provider fails

### Limits
- **Requests**: 15 per minute per IP
- **Message Length**: 1000 characters
- **Response Length**: ~2000 words (2048 tokens)
- **Chat History**: Last 10 messages
- **Session Duration**: 30 minutes of inactivity

### Optimization Tips
- Cache responses in frontend if appropriate
- Implement request debouncing for rapid successive messages
- Show loading indicators during 25-second window
- Monitor response times and adjust model selection if needed

## Troubleshooting

### "Missing GEMINI_API_KEY" Error
**Solution**: Set at least one API key in environment variables

### "Provider Unavailable" Error
**Causes**:
- Both provider API keys are invalid or missing
- Both providers are down/unreachable
- Network connectivity issue

**Solution**:
1. Verify API keys are valid
2. Test API keys directly with provider
3. Check network connectivity
4. Review server logs for specific error

### Slow Responses
**Causes**:
- Provider is slow (check their status page)
- Network latency
- Request hitting 25-second timeout

**Solution**:
1. Check provider status page
2. Try different primary provider via `AI_PROVIDER`
3. Increase timeout in `lib/provider.js` if needed
4. Monitor server logs for latency patterns

### Rate Limit Errors (429)
**Cause**: More than 15 requests per minute from same IP

**Solution**:
1. Implement client-side request debouncing
2. Cache responses when appropriate
3. Check for runaway request loops
4. Contact support if legitimate high-volume use case

## Security Considerations

### API Keys
- **Never commit `.env` file** with real keys to version control
- **Use `.gitignore`** to exclude `.env` from Git
- **Rotate keys** periodically in production
- **Use Vercel secrets** for production deployment
- **Monitor API usage** for unauthorized access patterns

### Input Validation
- Blocks prompt injection attempts automatically
- Validates message length and format
- Sanitizes all user input before sending to AI
- Escapes HTML/special characters in responses

### Rate Limiting
- Per-IP rate limiting (15 requests/minute)
- Prevents abuse and DDoS attacks
- Can be adjusted in `/lib/rateLimit.js`

### Session Management
- Sessions cleared after 30 minutes inactivity
- No sensitive data stored in sessions
- Session keys based on IP + User-Agent

## Monitoring & Logging

### Log Entries

All requests are logged with:
```
[api] {
  requestId: "uuid",
  route: "/api/chat",
  method: "POST",
  status: 200,
  latencyMs: 1234
}
```

Errors logged with additional details:
```
[api] {
  requestId: "uuid",
  route: "/api/chat",
  method: "POST",
  status: 502,
  latencyMs: 250,
  error: {
    code: "provider_invalid_json",
    status: 502,
    message: "Invalid JSON response"
  }
}
```

### Monitoring Checklist
- Track response times (target < 5 seconds)
- Monitor error rates by type
- Watch rate limit hits
- Check provider availability
- Review failed provider retries
- Alert on timeout patterns

## Advanced Configuration

### Custom Provider Prompt

Add per-user context via `customSystemPrompt` parameter:
```javascript
const reply = await callAI({
  userMessage: message,
  history,
  customSystemPrompt: "The user is a VIP client. Provide premium service."
});
```

### Adjusting Retry Logic

Edit retry configuration in `lib/provider.js` and `lib/gemini.js`:
```javascript
const MAX_RETRIES = 2;  // Maximum retry attempts
const REQUEST_TIMEOUT_MS = 25000;  // Timeout in milliseconds
const RETRY_DELAYS = [2000, 4000];  // Delays between retries
```

### Custom Error Messages

Edit error catalog in `lib/errors.js`:
```javascript
const ERROR_CATALOG = {
  provider_unavailable: { 
    status: 503, 
    code: "provider_unavailable", 
    message: "Custom message here" 
  }
};
```

## Support & Troubleshooting

### Documentation
- Gemini docs: https://ai.google.dev/docs
- Blackbox docs: https://www.blackbox.ai/docs
- Vercel docs: https://vercel.com/docs

### Getting Help
1. Check error logs for specific error codes
2. Review `DEPLOYMENT.md` for deployment issues
3. Verify environment variables are set correctly
4. Test with curl/Postman to isolate frontend issues
5. Check provider status pages for outages

## Future Enhancements

- [ ] Streaming response support
- [ ] Provider-specific response formatting
- [ ] Custom model selection per user
- [ ] Advanced analytics dashboard
- [ ] A/B testing for provider performance
- [ ] Cost optimization based on response size
- [ ] Voice input/output integration
- [ ] Custom fine-tuned models
