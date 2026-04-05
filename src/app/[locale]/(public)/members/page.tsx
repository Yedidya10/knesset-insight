import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { eq, asc, sql, and, or, ilike, inArray, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, factions, memberVotes, billInitiators } from '@/lib/db/schema';
import MemberCard from '@/components/members/MemberCard';
import MembersFilter from '@/components/members/MembersFilter';
import PaginationNav from '@/components/ui/pagination-nav';

const PAGE_SIZE = 60;

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

  // Get available knesset numbers
  const knessetNums = await db
    .selectDistinct({ knessetNum: factions.knessetNum })
    .from(factions)
    .innerJoin(members, eq(members.factionId, factions.id))
    .where(sql`${factions.knessetNum} IS NOT NULL`)
    .orderBy(desc(factions.knessetNum));
  const availableKnessets = knessetNums
    .map((k) => k.knessetNum)
    .filter((n): n is number => n !== null);

  const currentKnesset = availableKnessets[0] || 25;
  const selectedKnesset = knessetFilter ? Number(knessetFilter) : currentKnesset;
  const isCurrentKnesset = selectedKnesset === currentKnesset;

  // Smart faction list based on selected knesset context
  const factionListConditions = eq(factions.knessetNum, selectedKnesset);

  const factionQuery = db
    .selectDistinct({ name: factions.name })
    .from(factions)
    .innerJoin(members, eq(members.factionId, factions.id));
  const factionRows = await factionQuery.where(factionListConditions).orderBy(factions.name);
  const factionList = factionRows.map((f) => f.name).filter(Boolean);

  // Build member conditions
  const conditions = [];

  // Knesset filter: only show members whose faction belongs to this knesset
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

  // Status filter — only relevant when viewing the current knesset
  if (isCurrentKnesset) {
    if (statusFilter === 'current') {
      conditions.push(eq(members.isCurrent, true));
    } else if (statusFilter === 'past') {
      conditions.push(
        or(eq(members.isCurrent, false), sql`${members.isCurrent} IS NULL`),
      );
    }
  }
  // When viewing a past knesset, show ALL members of those factions

  // Coalition/opposition filter (uses faction-level coalition status)
  if (coalitionFilter === 'coalition') {
    conditions.push(eq(factions.isCoalition, true));
  } else if (coalitionFilter === 'opposition') {
    conditions.push(
      or(eq(factions.isCoalition, false), sql`${factions.isCoalition} IS NULL`),
    );
  }

  // Gender filter (matches DB values: "זכר" / "נקבה")
  if (genderFilter === 'male') {
    conditions.push(eq(members.gender, 'זכר'));
  } else if (genderFilter === 'female') {
    conditions.push(eq(members.gender, 'נקבה'));
  }

  if (partyFilter) {
    const matchingFactions = await db
      .select({ id: factions.id })
      .from(factions)
      .where(eq(factions.name, partyFilter));
    const factionIds = matchingFactions.map((f) => f.id);
    if (factionIds.length > 0) {
      conditions.push(inArray(members.factionId, factionIds));
    } else {
      conditions.push(sql`false`);
    }
  }

  if (searchQuery) {
    conditions.push(
      or(
        ilike(members.firstName, `%${searchQuery}%`),
        ilike(members.lastName, `%${searchQuery}%`),
      ),
    );
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

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

  // Query 2: Aggregated vote stats for the fetched members (single fast query)
  const voteStatsMap = new Map<number, { forCount: number; againstCount: number; abstainCount: number; absentCount: number; totalVotes: number }>();
  if (memberIds.length > 0) {
    const statsRows = await db
      .select({
        memberId: memberVotes.memberId,
        value: memberVotes.voteValue,
        count: sql<number>`count(*)::int`,
      })
      .from(memberVotes)
      .where(inArray(memberVotes.memberId, memberIds))
      .groupBy(memberVotes.memberId, memberVotes.voteValue);

    for (const row of statsRows) {
      if (!voteStatsMap.has(row.memberId)) {
        voteStatsMap.set(row.memberId, { forCount: 0, againstCount: 0, abstainCount: 0, absentCount: 0, totalVotes: 0 });
      }
      const entry = voteStatsMap.get(row.memberId)!;
      entry.totalVotes += row.count;
      if (row.value === 'for') entry.forCount = row.count;
      else if (row.value === 'against') entry.againstCount = row.count;
      else if (row.value === 'abstain') entry.abstainCount = row.count;
      else if (row.value === 'absent') entry.absentCount = row.count;
    }
  }

  // Query 3: Bill initiator counts per member
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

  // Merge all data
  const data = memberRows.map((m) => ({
    ...m,
    ...(voteStatsMap.get(m.id) ?? { forCount: 0, againstCount: 0, abstainCount: 0, absentCount: 0, totalVotes: 0 }),
    billCount: billCountMap.get(m.id) ?? 0,
  }));

  // Apply sorting in JS (member query already sorted by name)
  if (sortBy !== 'name') {
    data.sort((a, b) => {
      switch (sortBy) {
        case 'mostVotes': return b.totalVotes - a.totalVotes;
        case 'mostAbsent': return b.absentCount - a.absentCount;
        case 'mostBills': return b.billCount - a.billCount;
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
        default: return 0;
      }
    });
  }

  const subtitleKey =
    !isCurrentKnesset
      ? 'allMembers'
      : statusFilter === 'past'
        ? 'pastMembers'
        : 'currentMembers';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(subtitleKey)} ({totalCount})
          </p>
        </div>
      </div>

      <div className="mb-6">
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
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 stagger-children">
            {data.map((member) => (
              <MemberCard key={member.id} member={member} showDetails={showDetails} />
            ))}
          </div>
          <PaginationNav
            currentPage={page}
            totalPages={totalPages}
            buildPageUrl={(p) => {
              const urlParams = new URLSearchParams();
              if (partyFilter) urlParams.set('party', partyFilter);
              if (sortBy !== 'name') urlParams.set('sort', sortBy);
              if (statusFilter !== 'current') urlParams.set('status', statusFilter);
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
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Users className="h-8 w-8 opacity-30" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
