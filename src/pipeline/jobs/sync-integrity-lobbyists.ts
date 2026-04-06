import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { memberLobbyistConnections, members } from '../../lib/db/schema';
import { runSyncJob, type SyncCheckpoint } from '../utils';
import { appConfig } from '../../../app.config';

interface LobbyistRecord {
  lobbyist_name: string;
  lobbyist_id?: string;
  client_name?: string;
  mk_name?: string;
  event_date?: string;
  connection_type?: string;
}

/**
 * Sync lobbyist connection data from Open Knesset lobbyist registry.
 * Fetches the lobbyist datapackage.json and correlates with known members.
 */
export async function syncIntegrityLobbyists(): Promise<void> {
  await runSyncJob(
    'integrity-lobbyists',
    async (_prevCheckpoint: SyncCheckpoint | null) => {
      const sourceUrl = appConfig.integrity.sources.lobbyistRegistry;

      // Fetch datapackage to find the actual CSV resource URL
      const res = await fetch(sourceUrl);
      if (!res.ok) {
        throw new Error(
          `Failed to fetch lobbyist registry: ${res.status} ${res.statusText}`,
        );
      }

      const datapackage = (await res.json()) as {
        resources: Array<{ name: string; path: string }>;
      };

      // Find the main lobbyist list resource
      const listResource = datapackage.resources.find(
        (r) => r.name === 'lobbyists' || r.path.includes('lobbyists'),
      );

      if (!listResource) {
        console.log('[sync:integrity-lobbyists] No lobbyist resource found in datapackage');
        return 0;
      }

      // Resolve the CSV URL relative to the datapackage
      const baseUrl = sourceUrl.replace('/datapackage.json', '');
      const csvUrl = `${baseUrl}/${listResource.path}`;

      const csvRes = await fetch(csvUrl);
      if (!csvRes.ok) {
        throw new Error(
          `Failed to fetch lobbyist CSV: ${csvRes.status} ${csvRes.statusText}`,
        );
      }

      const csvText = await csvRes.text();
      const records = parseSimpleCSV(csvText);

      // Get all members for name matching
      const allMembers = await db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
        })
        .from(members);

      const memberNameMap = new Map<string, number>();
      for (const m of allMembers) {
        memberNameMap.set(`${m.firstName} ${m.lastName}`, m.id);
      }

      let count = 0;
      for (const record of records) {
        // Skip records that don't reference specific MKs
        if (!record.mk_name) continue;

        const memberId = memberNameMap.get(record.mk_name.trim());
        if (!memberId) continue;

        await db
          .insert(memberLobbyistConnections)
          .values({
            memberId,
            lobbyistName: record.lobbyist_name,
            lobbyistNumber: record.lobbyist_id ?? null,
            clientName: record.client_name ?? null,
            connectionType: record.connection_type ?? 'registered_contact',
            eventDate: record.event_date ?? null,
            sourceUrl: csvUrl,
          })
          .onConflictDoNothing();
        count++;
      }

      return count;
    },
  );
}

function parseSimpleCSV(text: string): LobbyistRecord[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = values[i] ?? '';
    });
    return record as unknown as LobbyistRecord;
  });
}
