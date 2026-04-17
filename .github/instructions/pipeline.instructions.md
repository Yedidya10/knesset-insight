---
applyTo: 'src/pipeline/**'
---

# Data Pipeline Instructions

## Rules

1. **Cron schedules from config** — never hardcode cron expressions:

   ```typescript
   import { appConfig } from '@/app.config';

   export const syncVotes = schedules.task({
     id: 'sync-votes',
     cron: appConfig.sync.odata,
     // ...
   });
   ```

2. **Data source URLs from config** — use `appConfig.dataSources`:

   ```typescript
   const url = `${appConfig.dataSources.knessetOdata}/ParliamentInfo.svc/KNS_Bill`;
   ```

3. **Incremental sync** — always use the most recent `lastSyncTimestamp`. Never do a full re-sync unless explicitly triggered.

4. **Error handling** — retry 3 times with exponential backoff. Log failures with structured logging (job ID, entity, error).

5. **After sync** — invalidate relevant Redis cache keys and regenerate AI embeddings for new/updated items.

6. **Embedding generation** — use `@/lib/ai/provider` for embeddings, same abstraction as chat.
