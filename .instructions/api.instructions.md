---
applyTo: "src/server/**,src/app/api/**"
---

# API & Backend Instructions

## Rules

1. **All configurable values from `appConfig`** — never hardcode limits, URLs, or schedules:
   ```typescript
   import { appConfig } from '@/app.config';
   
   // ✅ Correct
   const limit = appConfig.rateLimit.auth;
   
   // ❌ Wrong
   const limit = 200;
   ```

2. **Input validation with Zod** — every tRPC procedure and route handler must validate inputs:
   ```typescript
   const input = z.object({
     memberId: z.number().int().positive(),
     page: z.number().int().min(1).default(1),
   });
   ```

3. **Rate limiting** — use Upstash Redis Ratelimit:
   - Anonymous: `appConfig.rateLimit.anon` req/min
   - Authenticated: `appConfig.rateLimit.auth` req/min
   - AI Chat: `appConfig.ai.dailyChatLimit` chats/day (registered only)

4. **AI endpoints require authentication**:
   ```typescript
   // In tRPC: use protectedProcedure (not publicProcedure)
   export const aiRouter = router({
     chat: protectedProcedure
       .input(chatSchema)
       .mutation(async ({ ctx, input }) => {
         // ctx.session is guaranteed to exist
       }),
   });
   ```

5. **Database access** — always through Drizzle ORM. Never write raw SQL in application code.

6. **Cache strategy**:
   - Heavy aggregations: cache in Redis with TTL from config
   - Member profiles: ISR with 1-hour revalidation
   - Vote results: cache until next sync

7. **Error responses** — return standard error shapes via tRPC error codes. Include i18n-safe error keys, not hardcoded strings.
