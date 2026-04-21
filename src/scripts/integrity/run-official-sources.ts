/**
 * Phase 0 — Official authoritative sources.
 *
 * Runs the Knesset OData-based syncs that require NO AI analysis:
 *   - syncIntegrityKnesset  (Ethics Committee + House Committee immunity sessions)
 *   - syncIntegrityLobbyists (OKnesset lobbyist registry)
 *
 * These write directly to integrity_cases / member_lobbyist_connections from
 * authoritative government data. Run BEFORE the Tavily/Opus web pipeline.
 *
 * Run with:  pnpm tsx src/scripts/integrity/run-official-sources.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { syncIntegrityKnesset } =
    await import('../../pipeline/jobs/sync-integrity-knesset');
  const { syncIntegrityLobbyists } =
    await import('../../pipeline/jobs/sync-integrity-lobbyists');

  const start = Date.now();

  console.log('\n=== Phase 0a: Knesset Ethics + Immunity (OData) ===');
  try {
    await syncIntegrityKnesset();
  } catch (err) {
    console.error('[phase0a] Failed:', err);
  }

  console.log('\n=== Phase 0b: Lobbyist Registry (OKnesset) ===');
  try {
    await syncIntegrityLobbyists();
  } catch (err) {
    console.error('[phase0b] Failed:', err);
  }

  console.log(
    `\n[phase0] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[phase0] Fatal:', err);
  process.exit(1);
});
