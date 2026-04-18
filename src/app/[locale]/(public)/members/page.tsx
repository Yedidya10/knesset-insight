import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Users } from 'lucide-react';
import { eq, asc, sql, and, or, ilike, inArray, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  members,
  factions,
  billInitiators,
  memberFactionHistory,
  factionCoalitionPeriods,
  memberVotes,
  votes,
} from '@/lib/db/schema';
import MemberCard from '@/components/members/MemberCard';
import MembersFilter from '@/components/members/MembersFilter';
import PaginationNav from '@/components/ui/pagination-nav';

const PAGE_SIZE = 60;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.members');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

interface Props {
  searchParams: Promise<{
    party?: string;
    sort?: string;
    status?: string;
    search?: string;
    knesset?: string;
    coalition?: string;
    gender?: string;
    details?: string;
    page?: string;
  }>;
}

export default async function MembersPage({ searchParams }: Props) {
  const t = await getTranslations('members');
  const tCommon = await getTranslations('common');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;
  const partyFilter = params.party ?? '';
  const sortBy = params.sort ?? 'name';
  const statusFilter = params.status ?? 'current';
  const searchQuery = params.search ?? '';
  const knessetFilter = params.knesset ?? '';
  const coalitionFilter = params.coalition ?? '';
  const genderFilter = params.gender ?? '';
  const showDetails = params.details === 'true';

  // Get available knesset numbers from faction history (complete) + factions (current)
  const knessetNums = await db
    .selectDistinct({ knessetNum: memberFactionHistory.knessetNum })
    .from(memberFactionHistory)
    .orderBy(desc(memberFactionHistory.knessetNum));
  const availableKnessets = knessetNums
    .map((k) => k.knessetNum)
    .filter((n): n is number => n !== null);

  const currentKnesset = availableKnessets[0] || 25;
  const selectedKnesset = knessetFilter
    ? Number(knessetFilter)
    : currentKnesset;
  const isCurrentKnesset = selectedKnesset === currentKnesset;

  // Determine the latest government for the selected knesset
  const [maxGovRow] = await db
    .select({
      maxGov: sql<number>`max(${factionCoalitionPeriods.governmentNum})`,
    })
    .from(factionCoalitionPeriods)
    .where(eq(factionCoalitionPeriods.knessetNum, selectedKnesset));
  const latestGovNum = maxGovRow?.maxGov ?? null;

  // Fetch coalition factionIds for the latest government
  let coalitionFactionDbIds: Set<number> = new Set();
  if (latestGovNum != null) {
    const coalitionRows = await db
      .select({ factionId: factionCoalitionPeriods.factionId })
      .from(factionCoalitionPeriods)
      .where(
        and(
          eq(factionCoalitionPeriods.knessetNum, selectedKnesset),
          eq(factionCoalitionPeriods.governmentNum, latestGovNum),
        ),
      );
    coalitionFactionDbIds = new Set(coalitionRows.map((r) => r.factionId));
  }

  // For past knessets, pre-fetch member→faction mapping from history.
  // The members table stores only ONE factionId per member (typically latest),
  // but members serve across multiple knessets with different factions.
  // memberFactionHistory has the complete per-knesset faction data.
  type HistoryFactionInfo = {
    factionId: number;
    factionName: string | null;
    factionColor: string | null;
    isCoalition: boolean;
  };
  let historyFactionMap: Map<number, HistoryFactionInfo> | null = null;

  if (!isCurrentKnesset) {
    const historyRows = await db
      .select({
        memberId: memberFactionHistory.memberId,
        factionId: factions.id,
        factionName: factions.name,
        factionColor: factions.color,
        startDate: memberFactionHistory.startDate,
      })
      .from(memberFactionHistory)
      .innerJoin(factions, eq(memberFactionHistory.factionId, factions.id))
      .where(eq(memberFactionHistory.knessetNum, selectedKnesset))
      .orderBy(
        memberFactionHistory.memberId,
        desc(memberFactionHistory.startDate),
      );

    historyFactionMap = new Map();
    for (const row of historyRows) {
      // First entry per member is the latest (due to DESC startDate order)
      if (!historyFactionMap.has(row.memberId)) {
        historyFactionMap.set(row.memberId, {
          factionId: row.factionId,
          factionName: row.factionName,
          factionColor: row.factionColor,
          isCoalition: coalitionFactionDbIds.has(row.factionId),
        });
      }
    }
  }

  // Faction list for filter dropdown
  let factionList: Array<{ id: number; name: string }>;
  if (historyFactionMap) {
    const factionEntries = new Map<number, string>();
    for (const info of historyFactionMap.values()) {
      if (info.factionName && !factionEntries.has(info.factionId)) {
        factionEntries.set(info.factionId, info.factionName);
      }
    }
    factionList = [...factionEntries.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const factionRows = await db
      .selectDistinct({ id: factions.id, name: factions.name })
      .from(factions)
      .innerJoin(members, eq(members.factionId, factions.id))
      .where(eq(factions.knessetNum, selectedKnesset))
      .orderBy(factions.name);
    factionList = factionRows
      .filter((f) => f.name)
      .map((f) => ({ id: f.id, name: f.name }));
  }

  // Build member conditions
  const conditions = [];

  if (historyFactionMap) {
    // Past knesset: select members from faction history, pre-filter by party/coalition
    let eligibleIds = [...historyFactionMap.keys()];

    if (coalitionFilter === 'coalition') {
      eligibleIds = eligibleIds.filter(
        (id) => historyFactionMap!.get(id)?.isCoalition === true,
      );
    } else if (coalitionFilter === 'opposition') {
      eligibleIds = eligibleIds.filter(
        (id) => historyFactionMap!.get(id)?.isCoalition !== true,
      );
    }

    if (partyFilter) {
      const partyId = Number(partyFilter);
      eligibleIds = eligibleIds.filter(
        (id) => historyFactionMap!.get(id)?.factionId === partyId,
      );
    }

    if (eligibleIds.length > 0) {
      conditions.push(inArray(members.id, eligibleIds));
    } else {
      conditions.push(sql`false`);
    }
  } else {
    // Current knesset: filter by faction on members table
    const knessetFactionIds = await db
      .select({ id: factions.id })
      .from(factions)
      .where(eq(factions.knessetNum, selectedKnesset));
    const kfIds = knessetFactionIds.map((f) => f.id);
    if (kfIds.length > 0) {
      conditions.push(inArray(members.factionId, kfIds));
    } else {
      conditions.push(sql`false`);
    }

    // Status filter — only relevant for current knesset
    if (statusFilter === 'current') {
      conditions.push(eq(members.isCurrent, true));
    } else if (statusFilter === 'past') {
      conditions.push(
        or(eq(members.isCurrent, false), sql`${members.isCurrent} IS NULL`),
      );
    }

    // Coalition/opposition filter — use period-derived faction IDs
    if (coalitionFilter === 'coalition' && coalitionFactionDbIds.size > 0) {
      conditions.push(inArray(members.factionId, [...coalitionFactionDbIds]));
    } else if (coalitionFilter === 'opposition') {
      // Opposition = factions NOT in the coalition set
      const oppositionFactionIds = kfIds.filter(
        (id) => !coalitionFactionDbIds.has(id),
      );
      if (oppositionFactionIds.length > 0) {
        conditions.push(inArray(members.factionId, oppositionFactionIds));
      } else {
        conditions.push(sql`false`);
      }
    }
  }

  // Gender filter (matches DB values: "זכר" / "נקבה")
  if (genderFilter === 'male') {
    conditions.push(eq(members.gender, 'זכר'));
  } else if (genderFilter === 'female') {
    conditions.push(eq(members.gender, 'נקבה'));
  }

  if (!historyFactionMap && partyFilter) {
    const partyId = Number(partyFilter);
    if (!isNaN(partyId)) {
      conditions.push(eq(members.factionId, partyId));
    } else {
      conditions.push(sql`false`);
    }
  }

  if (searchQuery) {
    conditions.push(
      or(
        ilike(members.firstName, `%${searchQuery}%`),
        ilike(members.lastName, `%${searchQuery}%`),
        ilike(
          sql`${members.firstName} || ' ' || ${members.lastName}`,
          `%${searchQuery}%`,
        ),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count for pagination
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .leftJoin(factions, eq(members.factionId, factions.id))
    .where(whereClause);
  const totalCount = countResult?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Query 1: Fetch members with extra fields for new sorts
  const memberRows = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
      isCurrent: members.isCurrent,
      isCoalition: factions.isCoalition,
      factionId: members.factionId,
      factionName: factions.name,
      factionColor: factions.color,
      startDate: members.startDate,
      birthDate: members.birthDate,
      gender: members.gender,
    })
    .from(members)
    .leftJoin(factions, eq(members.factionId, factions.id))
    .where(whereClause)
    .orderBy(asc(members.lastName))
    .limit(PAGE_SIZE)
    .offset(offset);

  const memberIds = memberRows.map((m) => m.id);

  // Query 2: Bill initiator counts per member
  const billCountMap = new Map<number, number>();
  if (memberIds.length > 0) {
    const billRows = await db
      .select({
        memberId: billInitiators.memberId,
        count: sql<number>`count(*)::int`,
      })
      .from(billInitiators)
      .where(inArray(billInitiators.memberId, memberIds))
      .groupBy(billInitiators.memberId);

    for (const row of billRows) {
      billCountMap.set(row.memberId, row.count);
    }
  }

  // Query 3: Absence counts per member (voteValue = 'absent')
  const absentCountMap = new Map<number, number>();
  if (memberIds.length > 0) {
    const absentRows = await db
      .select({
        memberId: memberVotes.memberId,
        count: sql<number>`count(*)::int`,
      })
      .from(memberVotes)
      .innerJoin(votes, eq(memberVotes.voteId, votes.id))
      .where(
        and(
          inArray(memberVotes.memberId, memberIds),
          eq(memberVotes.voteValue, 'absent'),
          eq(votes.knessetNum, selectedKnesset),
        ),
      )
      .groupBy(memberVotes.memberId);

    for (const row of absentRows) {
      absentCountMap.set(row.memberId, row.count);
    }
  }

  // Merge all data — for past knessets, override faction data with history
  const data = memberRows.map((m) => {
    const historyInfo = historyFactionMap?.get(m.id);
    const isCoalition = historyInfo
      ? historyInfo.isCoalition
      : m.factionId
        ? coalitionFactionDbIds.has(m.factionId)
        : false;
    return {
      ...(historyInfo
        ? {
            ...m,
            factionId: historyInfo.factionId,
            factionName: historyInfo.factionName,
            factionColor: historyInfo.factionColor,
            isCoalition,
          }
        : { ...m, isCoalition }),
      billCount: billCountMap.get(m.id) ?? 0,
      absentCount: absentCountMap.get(m.id) ?? 0,
    };
  });

  // Apply sorting in JS (member query already sorted by name)
  if (sortBy !== 'name') {
    data.sort((a, b) => {
      switch (sortBy) {
        case 'mostBills':
          return b.billCount - a.billCount;
        case 'mostAbsent':
          return b.absentCount - a.absentCount;
        case 'seniority': {
          // Earliest startDate first; nulls last
          if (!a.startDate && !b.startDate) return 0;
          if (!a.startDate) return 1;
          if (!b.startDate) return -1;
          return a.startDate.localeCompare(b.startDate);
        }
        case 'age': {
          // Earliest birthDate first (oldest); nulls last
          if (!a.birthDate && !b.birthDate) return 0;
          if (!a.birthDate) return 1;
          if (!b.birthDate) return -1;
          return a.birthDate.localeCompare(b.birthDate);
        }
        default:
          return 0;
      }
    });
  }

  const subtitleKey = !isCurrentKnesset
    ? 'allMembers'
    : statusFilter === 'past'
      ? 'pastMembers'
      : 'currentMembers';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Users className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t(subtitleKey)} ({totalCount})
          </p>
        </div>
      </div>

      <div className="mb-6">
        <Suspense>
          <MembersFilter
            factions={factionList}
            currentFaction={partyFilter}
            currentSort={sortBy}
            currentStatus={statusFilter}
            currentSearch={searchQuery}
            knessetNumbers={availableKnessets}
            currentKnesset={knessetFilter || String(currentKnesset)}
            currentCoalition={coalitionFilter}
            currentGender={genderFilter}
            currentKnessetNumber={currentKnesset}
            showDetails={showDetails}
          />
        </Suspense>
      </div>

      {data.length > 0 ? (
        <>
          <div className="stagger-children grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {data.map((member, i) => (
              <MemberCard
                key={member.id}
                member={member}
                showDetails={showDetails}
                priority={i < 10}
              />
            ))}
          </div>
          <PaginationNav
            currentPage={page}
            totalPages={totalPages}
            buildPageUrl={(p) => {
              const urlParams = new URLSearchParams();
              if (partyFilter) urlParams.set('party', partyFilter);
              if (sortBy !== 'name') urlParams.set('sort', sortBy);
              if (statusFilter !== 'current')
                urlParams.set('status', statusFilter);
              if (searchQuery) urlParams.set('search', searchQuery);
              if (knessetFilter) urlParams.set('knesset', knessetFilter);
              if (coalitionFilter) urlParams.set('coalition', coalitionFilter);
              if (genderFilter) urlParams.set('gender', genderFilter);
              if (showDetails) urlParams.set('details', 'true');
              if (p > 1) urlParams.set('page', String(p));
              const qs = urlParams.toString();
              return `/members${qs ? `?${qs}` : ''}`;
            }}
            previousLabel={tCommon('previous')}
            nextLabel={tCommon('next')}
          />
        </>
      ) : (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Users className="h-8 w-8 opacity-30" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
