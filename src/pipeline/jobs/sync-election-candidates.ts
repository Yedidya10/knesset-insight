/**
 * AI-powered election candidate monitoring job.
 *
 * Uses Tavily web search + AI to detect changes in party candidate lists
 * for upcoming Knesset elections. Runs daily but is cost-efficient:
 * - First checks news via Tavily for candidate-related updates
 * - Only invokes AI if new information is detected
 * - Stores a hash of last known state to skip unchanged parties
 * - Auto-links candidates to MK profiles when they were/are Knesset members
 */
import { generateObject } from 'ai';
import { z } from 'zod';
import { tavily } from '@tavily/core';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import {
  electionCandidateLists,
  electionCandidates,
  members,
} from '@/lib/db/schema';
import { getAIModel } from '@/lib/ai/provider';
import { setLastSyncTime } from '@/pipeline/utils';
import { appConfig } from '../../../app.config';

const SYNC_ENTITY = 'election-candidates';

/** Schema for AI-extracted candidate data */
const candidateUpdateSchema = z.object({
  hasChanges: z
    .boolean()
    .describe('Whether meaningful candidate changes were found'),
  parties: z.array(
    z.object({
      partyName: z.string().describe('Hebrew party name'),
      slug: z
        .string()
        .describe('URL slug matching existing list slug, e.g. likud'),
      candidates: z.array(
        z.object({
          firstName: z.string().describe('Hebrew first name'),
          lastName: z.string().describe('Hebrew last name'),
          position: z
            .number()
            .nullable()
            .describe('Position on list, null if unknown'),
          isLeader: z.boolean(),
          profession: z.string().nullable(),
        }),
      ),
      source: z.string().describe('URL of the source confirming this'),
      confidence: z
        .enum(['high', 'medium', 'low'])
        .describe('Confidence in the accuracy of the data'),
    }),
  ),
  summary: z
    .string()
    .describe('Brief Hebrew summary of what changed, for logging'),
});

/**
 * Search news for recent election candidate updates.
 * Returns raw search results for AI analysis.
 */
async function searchForCandidateUpdates(): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn(
      '[candidate-sync] TAVILY_API_KEY not set, skipping web search',
    );
    return '';
  }

  const tvly = tavily({ apiKey });
  const electionDate = appConfig.elections2026.estimatedDate;

  const queries = [
    `רשימות מועמדים בחירות כנסת 26 ${new Date().getFullYear()}`,
    `פריימריז מפלגות בחירות ${electionDate}`,
    `רשימת מועמדים חדשה כנסת 2026`,
  ];

  const allResults: string[] = [];

  for (const query of queries) {
    try {
      const response = await tvly.search(query, {
        searchDepth: 'basic',
        maxResults: 5,
        includeDomains: [
          'ynet.co.il',
          'mako.co.il',
          'kan.org.il',
          'walla.co.il',
          'haaretz.co.il',
          'israelhayom.co.il',
          'globes.co.il',
          'knesset.gov.il',
          'votes.gov.il',
          'inn.co.il',
        ],
        topic: 'news',
      });

      for (const r of response.results ?? []) {
        allResults.push(`[${r.title}](${r.url})\n${r.content}`);
      }
    } catch (error) {
      console.error(
        `[candidate-sync] Search failed for "${query}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return allResults.join('\n\n---\n\n');
}

/**
 * Build a content hash of the current candidate data in DB for comparison.
 */
async function getCurrentStateHash(): Promise<string> {
  const candidates = await db
    .select({
      slug: electionCandidates.slug,
      firstName: electionCandidates.firstName,
      lastName: electionCandidates.lastName,
      position: electionCandidates.position,
      listSlug: electionCandidateLists.slug,
    })
    .from(electionCandidates)
    .innerJoin(
      electionCandidateLists,
      eq(electionCandidates.candidateListId, electionCandidateLists.id),
    )
    .orderBy(electionCandidateLists.slug, electionCandidates.slug);

  const hash = createHash('sha256');
  hash.update(JSON.stringify(candidates));
  return hash.digest('hex');
}

/**
 * Find a member ID by name, preferring current MKs.
 */
async function findMemberByName(
  firstName: string,
  lastName: string,
): Promise<number | null> {
  const allMembers = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      isCurrent: members.isCurrent,
    })
    .from(members);

  const matches = allMembers.filter(
    (m) => m.firstName === firstName && m.lastName === lastName,
  );
  if (matches.length === 0) return null;
  const current = matches.find((m) => m.isCurrent);
  return (current ?? matches[0]).id;
}

/**
 * Generate a slug from Hebrew name.
 */
function nameToSlug(firstName: string, lastName: string): string {
  const translitMap: Record<string, string> = {
    א: 'a',
    ב: 'b',
    ג: 'g',
    ד: 'd',
    ה: 'h',
    ו: 'v',
    ז: 'z',
    ח: 'ch',
    ט: 't',
    י: 'y',
    כ: 'k',
    ך: 'k',
    ל: 'l',
    מ: 'm',
    ם: 'm',
    נ: 'n',
    ן: 'n',
    ס: 's',
    ע: 'a',
    פ: 'p',
    ף: 'f',
    צ: 'tz',
    ץ: 'tz',
    ק: 'k',
    ר: 'r',
    ש: 'sh',
    ת: 't',
  };

  function transliterate(text: string): string {
    return text
      .split('')
      .map((ch) => translitMap[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  return `${transliterate(firstName)}-${transliterate(lastName)}`;
}

export async function syncElectionCandidates(): Promise<void> {
  console.log('[candidate-sync] Starting AI candidate monitoring...');

  // Check if election is still upcoming
  const electionDate = new Date(appConfig.elections2026.estimatedDate);
  const now = new Date();
  if (now > electionDate) {
    console.log(
      '[candidate-sync] Election date has passed, skipping candidate monitoring',
    );
    return;
  }

  // 1. Search for recent news (start async before DB queries)
  const searchResults = searchForCandidateUpdates();

  const newsContent = await searchResults;

  if (!newsContent.trim()) {
    console.log('[candidate-sync] No news results found, skipping AI call');
    return;
  }

  // 3. Get current candidate lists for context
  const currentLists = await db
    .select({
      slug: electionCandidateLists.slug,
      name: electionCandidateLists.name,
      status: electionCandidateLists.status,
    })
    .from(electionCandidateLists);

  const currentCandidates = await db
    .select({
      firstName: electionCandidates.firstName,
      lastName: electionCandidates.lastName,
      listSlug: electionCandidateLists.slug,
      position: electionCandidates.position,
    })
    .from(electionCandidates)
    .innerJoin(
      electionCandidateLists,
      eq(electionCandidates.candidateListId, electionCandidateLists.id),
    );

  const currentStateDescription = currentLists
    .map((list) => {
      const candidates = currentCandidates
        .filter((c) => c.listSlug === list.slug)
        .map((c) => `${c.firstName} ${c.lastName} (#${c.position ?? '?'})`)
        .join(', ');
      return `${list.name} (${list.slug}): ${candidates || 'ראש רשימה בלבד'}`;
    })
    .join('\n');

  // 4. Ask AI to analyze the news
  console.log('[candidate-sync] Analyzing news with AI...');
  const model = getAIModel();

  const { object: analysis } = await generateObject({
    model,
    schema: candidateUpdateSchema,
    prompt: `אתה מנתח נתוני בחירות לכנסת ה-26 בישראל (${appConfig.elections2026.estimatedDate}).

## המצב הנוכחי במערכת:
${currentStateDescription}

## חדשות אחרונות:
${newsContent}

## המשימה שלך:
בדוק האם יש מידע חדש ומאומת על רשימות מועמדים שעדיין לא נמצא במערכת.
- רק מועמדים שאושרו רשמית (לאחר פריימריז, החלטת מועצת מפלגה, או הכרזה רשמית)
- אל תכלול ספקולציות או שמועות
- אל תכלול מועמדים שכבר נמצאים במערכת
- ציין רק מפלגות שיש בהן שינוי בפועל

אם אין שינויים חדשים, החזר hasChanges: false.`,
  });

  if (!analysis.hasChanges || analysis.parties.length === 0) {
    console.log('[candidate-sync] No changes detected');
    const currentHash = await getCurrentStateHash();
    await setLastSyncTime(SYNC_ENTITY, new Date(), 0, 'success', undefined, {
      stateHash: currentHash,
    });
    return;
  }

  console.log(`[candidate-sync] Changes detected: ${analysis.summary}`);

  // 5. Apply changes — only high/medium confidence
  let added = 0;
  for (const party of analysis.parties) {
    if (party.confidence === 'low') {
      console.log(
        `[candidate-sync] Skipping ${party.partyName} (low confidence)`,
      );
      continue;
    }

    const list = currentLists.find((l) => l.slug === party.slug);
    if (!list) {
      console.log(
        `[candidate-sync] Unknown party slug "${party.slug}", skipping`,
      );
      continue;
    }

    const listRecord = await db
      .select({ id: electionCandidateLists.id })
      .from(electionCandidateLists)
      .where(eq(electionCandidateLists.slug, party.slug))
      .limit(1);

    if (!listRecord[0]) continue;
    const listId = listRecord[0].id;

    for (const candidate of party.candidates) {
      // Check if already exists
      const slug = nameToSlug(candidate.firstName, candidate.lastName);
      const existing = await db
        .select({ id: electionCandidates.id })
        .from(electionCandidates)
        .where(eq(electionCandidates.slug, slug))
        .limit(1);

      if (existing[0]) {
        // Update position if changed
        if (candidate.position != null) {
          await db
            .update(electionCandidates)
            .set({ position: candidate.position })
            .where(eq(electionCandidates.id, existing[0].id));
        }
        continue;
      }

      // Link to MK if applicable
      const memberId = await findMemberByName(
        candidate.firstName,
        candidate.lastName,
      );

      await db.insert(electionCandidates).values({
        candidateListId: listId,
        slug,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        position: candidate.position,
        isLeader: candidate.isLeader,
        profession: candidate.profession,
        memberId,
        status: 'confirmed',
      });
      added++;
      console.log(
        `[candidate-sync] Added ${candidate.firstName} ${candidate.lastName} to ${party.partyName}`,
      );
    }
  }

  // Update checkpoint with new hash
  const newHash = await getCurrentStateHash();
  await setLastSyncTime(SYNC_ENTITY, new Date(), added, 'success', undefined, {
    stateHash: newHash,
    lastSummary: analysis.summary,
  });

  console.log(
    `[candidate-sync] Done. Added ${added} candidates. Summary: ${analysis.summary}`,
  );
}
