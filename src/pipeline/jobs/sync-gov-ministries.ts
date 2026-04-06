import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { govMinistries } from '../../lib/db/schema';
import { fetchAllOData } from '../../lib/knesset/odata-client';
import { runSyncJob } from '../utils';

const BATCH_SIZE = 50;

interface ODataGovMinistry {
  GovMinistryID: number;
  Name: string;
  IsActive: boolean;
  LastUpdatedDate: string;
}

async function syncGovMinistryRecords(): Promise<number> {
  const raw = await fetchAllOData<ODataGovMinistry>(
    'ParliamentInfo',
    'KNS_GovMinistry',
    {},
    100,
    'gov-ministries',
  );

  console.log(`  [gov-ministries] Fetched ${raw.length} ministries`);

  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const batch = raw.slice(i, i + BATCH_SIZE);
    const rows = batch.map((m) => ({
      knessetId: m.GovMinistryID,
      name: m.Name,
      isActive: m.IsActive,
    }));

    await db
      .insert(govMinistries)
      .values(rows)
      .onConflictDoUpdate({
        target: govMinistries.knessetId,
        set: {
          name: sql`excluded.name`,
          isActive: sql`excluded.is_active`,
          updatedAt: new Date(),
        },
      });
  }

  return raw.length;
}

export async function syncGovMinistries(): Promise<void> {
  await runSyncJob('gov-ministries', syncGovMinistryRecords);
}
