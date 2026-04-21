import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Users, History } from 'lucide-react';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { db } from '@/lib/db';
import { committees, committeeMembers, members } from '@/lib/db/schema';
import { SUPPORTED_COMMITTEE_KNESSETS } from '@/lib/committees/scope';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CommitteesFilter from '@/components/committees/CommitteesFilter';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.committees');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const str = Array.isArray(value) ? value[0] : value;
  return str ? str.split(',').filter(Boolean) : [];
}

function parseNum(value: string | string[] | undefined): number | null {
  if (!value) return null;
  const str = Array.isArray(value) ? value[0] : value;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

export default async function CommitteesPage({ searchParams }: PageProps) {
  const t = await getTranslations('committees');
  const sp = await searchParams;

  // ── Parse filter params ───────────────────────────────────────────
  const search = (typeof sp.search === 'string' ? sp.search : '').trim();
  const knessetFilter = parseList(sp.knesset)
    .map(Number)
    .filter(Number.isFinite);
  const typeFilter = parseList(sp.type);
  const activeOnly = sp.active === 'true';
  const chairmanFilter = parseList(sp.chairmanId)
    .map(Number)
    .filter(Number.isFinite);
  const memberCountFrom = parseNum(sp.memberCountFrom);
  const memberCountTo = parseNum(sp.memberCountTo);

  const sortField = typeof sp.sort === 'string' ? sp.sort : 'name';
  const sortDir = sp.sortDir === 'desc' ? 'desc' : 'asc';

  // ── Build WHERE ───────────────────────────────────────────────────
  const conditions: SQL[] = [
    inArray(committees.knessetNum, [...SUPPORTED_COMMITTEE_KNESSETS]),
  ];

  if (search) conditions.push(ilike(committees.name, `%${search}%`));
  if (knessetFilter.length > 0) {
    conditions.push(inArray(committees.knessetNum, knessetFilter));
  }
  if (typeFilter.length > 0) {
    conditions.push(inArray(committees.committeeType, typeFilter));
  }
  if (activeOnly) {
    conditions.push(eq(committees.isActive, true));
  }
  if (chairmanFilter.length > 0) {
    conditions.push(inArray(committees.chairmanId, chairmanFilter));
  }

  // ── ORDER BY ──────────────────────────────────────────────────────
  const memberCountExpr = sql<number>`count(distinct ${committeeMembers.memberId}) filter (where ${committeeMembers.isCurrent})`;

  const orderBy: SQL[] = [];
  const dirFn = sortDir === 'desc' ? desc : asc;
  if (sortField === 'memberCount') {
    orderBy.push(dirFn(memberCountExpr));
    orderBy.push(asc(committees.name));
  } else if (sortField === 'knesset') {
    orderBy.push(dirFn(committees.knessetNum));
    orderBy.push(asc(committees.name));
  } else {
    // default: name, but always keep active first unless user explicitly sorts
    orderBy.push(desc(committees.isActive));
    orderBy.push(dirFn(committees.name));
  }

  // ── Query in parallel: list + filter option sources ───────────────
  const [data, typeRows, chairmanRows] = await Promise.all([
    db
      .select({
        id: committees.id,
        name: committees.name,
        committeeType: committees.committeeType,
        knessetNum: committees.knessetNum,
        isActive: committees.isActive,
        memberCount: memberCountExpr,
      })
      .from(committees)
      .leftJoin(
        committeeMembers,
        eq(committeeMembers.committeeId, committees.id),
      )
      .where(and(...conditions))
      .groupBy(
        committees.id,
        committees.name,
        committees.committeeType,
        committees.knessetNum,
        committees.isActive,
      )
      .having(
        memberCountFrom != null && memberCountTo != null
          ? and(
              gte(memberCountExpr, memberCountFrom),
              lte(memberCountExpr, memberCountTo),
            )
          : memberCountFrom != null
            ? gte(memberCountExpr, memberCountFrom)
            : memberCountTo != null
              ? lte(memberCountExpr, memberCountTo)
              : sql`true`,
      )
      .orderBy(...orderBy),
    db
      .selectDistinct({ committeeType: committees.committeeType })
      .from(committees)
      .where(inArray(committees.knessetNum, [...SUPPORTED_COMMITTEE_KNESSETS])),
    db
      .selectDistinct({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
      })
      .from(committees)
      .innerJoin(members, eq(members.id, committees.chairmanId))
      .where(inArray(committees.knessetNum, [...SUPPORTED_COMMITTEE_KNESSETS]))
      .orderBy(members.lastName, members.firstName),
  ]);

  const committeeTypes = typeRows
    .map((r) => r.committeeType)
    .filter((v): v is string => !!v)
    .sort((a, b) => a.localeCompare(b, 'he'));

  const chairmen = chairmanRows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`,
  }));

  // Hide inactive committees whose name matches an active successor —
  // keeps the "inactive" list uncluttered when not explicitly filtered.
  const active = data.filter((c) => c.isActive);
  const activeNames = new Set(active.map((c) => c.name));
  const inactive = data.filter((c) => !c.isActive && !activeNames.has(c.name));

  const activeWithHistory = active.map((c) => {
    const previousKnessets = data.filter(
      (other) => !other.isActive && other.name === c.name,
    );
    return { ...c, previousKnessetCount: previousKnessets.length };
  });

  const hasAnyFilter =
    search ||
    knessetFilter.length > 0 ||
    typeFilter.length > 0 ||
    activeOnly ||
    chairmanFilter.length > 0 ||
    memberCountFrom != null ||
    memberCountTo != null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Users className="text-primary h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {active.length} {t('active')} · {inactive.length} {t('inactive')}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <CommitteesFilter
          knessetNumbers={[...SUPPORTED_COMMITTEE_KNESSETS].sort(
            (a, b) => b - a,
          )}
          committeeTypes={committeeTypes}
          chairmen={chairmen}
        />
      </div>

      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">{t('active')}</h2>
          <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeWithHistory.map((committee) => (
              <Link key={committee.id} href={`/committees/${committee.id}`}>
                <Card className="glass-card hover-lift h-full overflow-hidden border-s-4 border-s-green-500/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-tight">
                      {committee.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    {committee.committeeType && (
                      <Badge variant="outline">{committee.committeeType}</Badge>
                    )}
                    {committee.knessetNum && (
                      <Badge variant="secondary">
                        {t('knesset')} {committee.knessetNum}
                      </Badge>
                    )}
                    {committee.memberCount > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {committee.memberCount}
                      </Badge>
                    )}
                    {committee.previousKnessetCount > 0 && (
                      <Badge variant="outline" className="gap-1 opacity-60">
                        <History className="h-3 w-3" />+
                        {committee.previousKnessetCount}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && !activeOnly && (
        <div>
          <h2 className="text-muted-foreground mb-4 text-lg font-semibold">
            {t('inactive')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inactive.map((committee) => (
              <Link key={committee.id} href={`/committees/${committee.id}`}>
                <Card className="glass-card border-s-muted-foreground/20 h-full overflow-hidden border-s-4 opacity-60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-tight">
                      {committee.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    {committee.committeeType && (
                      <Badge variant="outline">{committee.committeeType}</Badge>
                    )}
                    {committee.knessetNum && (
                      <Badge variant="secondary">
                        {t('knesset')} {committee.knessetNum}
                      </Badge>
                    )}
                    {committee.memberCount > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {committee.memberCount}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 && (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Users className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">
            {hasAnyFilter ? t('filter.noResults') : t('noResults')}
          </p>
        </div>
      )}
    </div>
  );
}
