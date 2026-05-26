# TODO

- [ ] Make greeting/conversational opener detection reliably pass domain guard at runtime (`lib/validate.js`)
- [ ] Add upstream AI diagnostics and retry-path logging without leaking secrets (`lib/blackbox.js`)
- [ ] Harden `/api/chat` normalized fallback responses and add structured error context logs (`api/chat.js`)
- [ ] Run targeted backend tests for greeting pass, unrelated block, and provider-failure fallback behavior
- [ ] Summarize Vercel env/log checks for production troubleshooting
