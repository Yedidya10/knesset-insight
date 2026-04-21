/**
 * Generic migration applier.
 *
 * Usage: pnpm tsx src/scripts/apply-migration.ts <filename>
 *   (filename is relative to the drizzle/ directory)
 *
 * Runs each `;`-terminated statement individually (strips SQL line comments).
 * Safe to re-run migrations that use `IF NOT EXISTS` / `IF EXISTS` guards.
 */
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

config({ path: '.env.local' });

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: pnpm tsx src/scripts/apply-migration.ts <filename>');
    process.exit(1);
  }

  const postgres = (await import('postgres')).default;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const migrationPath = resolve(process.cwd(), 'drizzle', file);
  const sql = readFileSync(migrationPath, 'utf8');

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
  console.log(`[migration] ${file} — ${statements.length} statements`);

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 90);
    process.stdout.write(`  → ${preview}${stmt.length > 90 ? '…' : ''}\n`);
    try {
      await client.unsafe(stmt);
    } catch (err) {
      console.error(`    ✗ ${(err as Error).message}`);
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
