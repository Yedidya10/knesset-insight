---
applyTo: 'src/lib/ai/**'
---

# AI Provider Instructions

## Architecture

The AI system uses an **abstraction layer** so the provider can be swapped via config:

```
appConfig.ai.provider → 'gemini' (default) | 'openai'
```

## Rules

1. **Never import AI SDKs directly** — always use `@/lib/ai/provider`:

   ```typescript
   // ✅ Correct
   import { getAIClient } from '@/lib/ai/provider';

   // ❌ Wrong — never do this
   import OpenAI from 'openai';
   import { GoogleGenerativeAI } from '@google/generative-ai';
   ```

2. **Use Vercel AI SDK as the wrapper** — it supports both Gemini and OpenAI:

   ```typescript
   import { generateText, streamText } from 'ai';
   import { getModel } from '@/lib/ai/provider';

   const result = await streamText({
     model: getModel(), // reads from appConfig
     messages,
   });
   ```

3. **Default model is Gemini** (`gemini-2.5-flash`). OpenAI is fallback. Both configurable via env vars:
   - `AI_PROVIDER` — primary provider
   - `AI_DEFAULT_MODEL` — primary model
   - `AI_FALLBACK_PROVIDER` — fallback on error
   - `AI_FALLBACK_MODEL` — fallback model

4. **Embeddings** also use the abstraction:
   - Default: Gemini `text-embedding-004` (768 dimensions)
   - Fallback: OpenAI `text-embedding-3-small` (1536 dimensions)
   - Dimension is configurable via `EMBEDDING_DIMENSIONS`

5. **AI Chat is for registered users only** — every AI endpoint must:

   ```typescript
   // 1. Verify authentication
   const session = await getSession();
   if (!session) return new Response('Unauthorized', { status: 401 });

   // 2. Check daily limit
   const count = await getDailyUsage(session.user.id);
   if (count >= appConfig.ai.dailyChatLimit) {
     return new Response('Daily limit reached', { status: 429 });
   }

   // 3. Increment counter
   await incrementDailyUsage(session.user.id);
   ```

6. **System prompts** — defined in `src/lib/ai/prompts.ts`. Keep them neutral, factual, and instruct the model to cite sources.

7. **Error handling** — if primary provider fails, automatically try fallback provider before returning an error to the user.
