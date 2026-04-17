---
applyTo: 'app.config.ts,src/lib/config.ts,.env*'
---

# Configuration & Scalability Instructions

## Central Config Pattern

All configurable values flow through `app.config.ts`:

```
env var → app.config.ts → consumer code
```

## Rules

1. **Never hardcode values** that could change:
   - Rate limits
   - API URLs
   - Cron schedules
   - AI model names
   - Feature flags
   - Locale list
   - Daily limits

2. **Every env var has a sensible default** in `app.config.ts`. The app should start with zero env vars in development.

3. **Adding a new configurable value**:
   1. Add the env var to `.env.example` with description
   2. Add it to `app.config.ts` with a default value
   3. Use `appConfig.section.value` in code
   4. Never read `process.env.X` directly in application code (only in `app.config.ts`)

4. **Client-side env vars** must be prefixed with `NEXT_PUBLIC_`.

5. **Secrets** (API keys, DB passwords) must NOT have defaults — they should fail clearly in dev if missing.

6. **Feature flags** — use `appConfig.features.X` to toggle features. This makes it easy to disable features via env vars without code changes.
