import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

config({ path: '.env.local' });

async function main() {
  const postgres = (await import('postgres')).default;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const migrationPath = resolve(
    process.cwd(),
    'drizzle/0019_advanced_filter_indexes.sql',
  );
  const sql = readFileSync(migrationPath, 'utf8');

  // Split on semicolon at end of line; CREATE INDEX CONCURRENTLY is not used,
  // so regular transactions/statements are fine.
  const statements = sql
    .split(/;\s*$/m)
    .map((raw) =>
      raw
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);

  const client = postgres(url, { prepare: false, max: 1 });
  console.log(
    `[migration] applying 0019_advanced_filter_indexes — ${statements.length} statements`,
  );

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 90);
    process.stdout.write(`  → ${preview}${stmt.length > 90 ? '…' : ''}\n`);
    try {
      await client.unsafe(stmt);
    } catch (err) {
      console.error(`    ✗ failed: ${(err as Error).message}`);
      throw err;
    }
  }

  console.log('[migration] ✓ complete');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
