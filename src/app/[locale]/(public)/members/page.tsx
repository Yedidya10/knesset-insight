import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Users } from 'lucide-react';
import { eq, asc, sql, and, or, ilike, inArray, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  members,
  factions,
  politicalGroups,
  billInitiators,
  memberFactionHistory,
  factionCoalitionPeriods,
  memberVotes,
  votes,
  committees,
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
    sortDir?: string;
    status?: string;
    search?: string;
    knesset?: string;
    coalition?: string;
    gender?: string;
    details?: string;
    page?: string;
    committee?: string;
    politicalGroup?: string;
    knessetTerms?: string;
    committeeRole?: string;
    ageFrom?: string;
    ageTo?: string;
    seniorityFrom?: string;
    seniorityTo?: string;
  }>;
}

function parseList(v?: string): number[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

export default async function MembersPage({ searchParams }: Props) {
  const t = await getTranslations('members');
  const tCommon = await getTranslations('common');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;
  const partyIds = parseList(params.party);
  const sortBy = params.sort ?? 'name';
  const sortDir: 'asc' | 'desc' = params.sortDir === 'desc' ? 'desc' : 'asc';
  const statusFilter = params.status ?? 'current';
  const searchQuery = params.search ?? '';
  const knessetFilter = params.knesset ?? '';
  const coalitionFilter = params.coalition ?? '';
  const genderFilter = params.gender ?? '';
  const showDetails = params.details === 'true';
  const committeeIds = parseList(params.committee);
  const politicalGroupIds = parseList(params.politicalGroup);
  const knessetTerms = parseList(params.knessetTerms);
  const committeeRole = params.committeeRole ?? '';
  const ageFrom = params.ageFrom ? Number(params.ageFrom) : null;
  const ageTo = params.ageTo ? Number(params.ageTo) : null;
  const seniorityFrom = params.seniorityFrom
    ? Number(params.seniorityFrom)
    : null;
  const seniorityTo = params.seniorityTo ? Number(params.seniorityTo) : null;

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

  // Political groups list (cross-term)
  const pgRows = await db
    .select({ id: politicalGroups.id, name: politicalGroups.canonicalName })
    .from(politicalGroups)
    .orderBy(politicalGroups.canonicalName);
  const politicalGroupList = pgRows.map((r) => ({ id: r.id, name: r.name }));

  // Committee list for filter dropdown
  const committeeList = await db
    .select({ id: committees.id, name: committees.name })
    .from(committees)
    .where(eq(committees.isActive, true))
    .orderBy(committees.name);

  // Build member conditions
  const conditions = [];

  if (historyFactionMap) {
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

    if (partyIds.length > 0) {
      const partySet = new Set(partyIds);
      eligibleIds = eligibleIds.filter((id) =>
        partySet.has(historyFactionMap!.get(id)?.factionId ?? -1),
      );
    }

    if (eligibleIds.length > 0) {
      conditions.push(inArray(members.id, eligibleIds));
    } else {
      conditions.push(sql`false`);
    }
  } else {
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

    if (statusFilter === 'current') {
      conditions.push(eq(members.isCurrent, true));
    } else if (statusFilter === 'past') {
      conditions.push(
        or(eq(members.isCurrent, false), sql`${members.isCurrent} IS NULL`),
      );
    }

    if (coalitionFilter === 'coalition' && coalitionFactionDbIds.size > 0) {
      conditions.push(inArray(members.factionId, [...coalitionFactionDbIds]));
    } else if (coalitionFilter === 'opposition') {
      const oppositionFactionIds = kfIds.filter(
        (id) => !coalitionFactionDbIds.has(id),
      );
      if (oppositionFactionIds.length > 0) {
        conditions.push(inArray(members.factionId, oppositionFactionIds));
      } else {
        conditions.push(sql`false`);
      }
    }

    if (partyIds.length > 0) {
      conditions.push(inArray(members.factionId, partyIds));
    }
  }

  if (genderFilter === 'male') {
    conditions.push(eq(members.gender, 'זכר'));
  } else if (genderFilter === 'female') {
    conditions.push(eq(members.gender, 'נקבה'));
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

  // Committee membership filter (multi-select)
  if (committeeIds.length > 0) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM committee_members cm WHERE cm.member_id = ${members.id} AND cm.committee_id = ANY(${committeeIds}))`,
    );
  }

  // Political group filter — via factions.political_group_id
  if (politicalGroupIds.length > 0) {
    conditions.push(
      sql`${members.factionId} IN (
        SELECT id FROM factions WHERE political_group_id = ANY(${politicalGroupIds})
      )`,
    );
  }

  // Knesset terms served — via memberFactionHistory
  if (knessetTerms.length > 0) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM member_faction_history mfh
        WHERE mfh.member_id = ${members.id} AND mfh.knesset_num = ANY(${knessetTerms})
      )`,
    );
  }

  // Committee role filter
  if (committeeRole === 'chair') {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM committee_members cm WHERE cm.member_id = ${members.id} AND cm.position_id = 41)`,
    );
  } else if (committeeRole === 'deputy') {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM committee_members cm WHERE cm.member_id = ${members.id} AND cm.position_id = 67)`,
    );
  } else if (committeeRole === 'member') {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM committee_members cm WHERE cm.member_id = ${members.id} AND (cm.position_id IS NULL OR cm.position_id NOT IN (41, 67)))`,
    );
  }

  // Age range (years from birth_date)
  if (ageFrom != null && !Number.isNaN(ageFrom)) {
    conditions.push(
      sql`date_part('year', age(${members.birthDate})) >= ${ageFrom}`,
    );
  }
  if (ageTo != null && !Number.isNaN(ageTo)) {
    conditions.push(
      sql`date_part('year', age(${members.birthDate})) <= ${ageTo}`,
    );
  }

  // Seniority range (years from start_date)
  if (seniorityFrom != null && !Number.isNaN(seniorityFrom)) {
    conditions.push(
      sql`date_part('year', age(${members.startDate})) >= ${seniorityFrom}`,
    );
  }
  if (seniorityTo != null && !Number.isNaN(seniorityTo)) {
    conditions.push(
      sql`date_part('year', age(${members.startDate})) <= ${seniorityTo}`,
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

  // Fetch ALL matching members — sort requires some post-processing (billCount / absentCount)
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
    .orderBy(asc(members.lastName));

  const allMemberIds = memberRows.map((m) => m.id);

  const billCountMap = new Map<number, number>();
  if (allMemberIds.length > 0) {
    const billRows = await db
      .select({
        memberId: billInitiators.memberId,
        count: sql<number>`count(*)::int`,
      })
      .from(billInitiators)
      .where(inArray(billInitiators.memberId, allMemberIds))
      .groupBy(billInitiators.memberId);

    for (const row of billRows) {
      billCountMap.set(row.memberId, row.count);
    }
  }

  const absentCountMap = new Map<number, number>();
  if (allMemberIds.length > 0) {
    const absentRows = await db
      .select({
        memberId: memberVotes.memberId,
        count: sql<number>`count(*)::int`,
      })
      .from(memberVotes)
      .innerJoin(votes, eq(memberVotes.voteId, votes.id))
      .where(
        and(
          inArray(memberVotes.memberId, allMemberIds),
          eq(memberVotes.voteValue, 'absent'),
          eq(votes.knessetNum, selectedKnesset),
        ),
      )
      .groupBy(memberVotes.memberId);

    for (const row of absentRows) {
      absentCountMap.set(row.memberId, row.count);
    }
  }

  const allData = memberRows.map((m) => {
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

  // Global sort — apply direction via sign
  const sign = sortDir === 'desc' ? -1 : 1;
  allData.sort((a, b) => {
    switch (sortBy) {
      case 'mostBills':
        return sign * (b.billCount - a.billCount);
      case 'mostAbsent':
        return sign * (b.absentCount - a.absentCount);
      case 'seniority': {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return sign * a.startDate.localeCompare(b.startDate);
      }
      case 'age': {
        if (!a.birthDate && !b.birthDate) return 0;
        if (!a.birthDate) return 1;
        if (!b.birthDate) return -1;
        return sign * a.birthDate.localeCompare(b.birthDate);
      }
      case 'name':
      default: {
        const la = `${a.lastName} ${a.firstName}`;
        const lb = `${b.lastName} ${b.firstName}`;
        return sign * la.localeCompare(lb);
      }
    }
  });

  const data = allData.slice(offset, offset + PAGE_SIZE);

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
            politicalGroups={politicalGroupList}
            knessetNumbers={availableKnessets}
            currentKnessetNumber={currentKnesset}
            showDetails={showDetails}
            committees={committeeList}
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
              if (params.party) urlParams.set('party', params.party);
              if (sortBy !== 'name') urlParams.set('sort', sortBy);
              if (sortDir !== 'asc') urlParams.set('sortDir', sortDir);
              if (statusFilter !== 'current')
                urlParams.set('status', statusFilter);
              if (searchQuery) urlParams.set('search', searchQuery);
              if (knessetFilter) urlParams.set('knesset', knessetFilter);
              if (coalitionFilter) urlParams.set('coalition', coalitionFilter);
              if (genderFilter) urlParams.set('gender', genderFilter);
              if (params.committee)
                urlParams.set('committee', params.committee);
              if (params.politicalGroup)
                urlParams.set('politicalGroup', params.politicalGroup);
              if (params.knessetTerms)
                urlParams.set('knessetTerms', params.knessetTerms);
              if (committeeRole) urlParams.set('committeeRole', committeeRole);
              if (params.ageFrom) urlParams.set('ageFrom', params.ageFrom);
              if (params.ageTo) urlParams.set('ageTo', params.ageTo);
              if (params.seniorityFrom)
                urlParams.set('seniorityFrom', params.seniorityFrom);
              if (params.seniorityTo)
                urlParams.set('seniorityTo', params.seniorityTo);
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
