import { getTranslations, getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import {
  Gavel,
  GitMerge,
  GitBranch,
  Pause,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import {
  desc,
  asc,
  eq,
  sql,
  ilike,
  and,
  or,
  exists,
  inArray,
  gte,
  lte,
} from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import {
  bills,
  billNames,
  members,
  factions,
  committees,
} from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TranslatedText from '@/components/ui/translated-text';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.legislation');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}
import PaginationNav from '@/components/ui/pagination-nav';
import LegislationFilter from '@/components/legislation/LegislationFilter';
import EntityActivityPopover from '@/components/admin/inline/EntityActivityPopover';
import { getBillStatusText } from '@/lib/knesset/bill-status';
import { computeBillStage } from '@/lib/knesset/bill-stages';

const BILL_TYPE_SLUGS = ['government', 'private', 'committee'] as const;
type BillTypeSlug = (typeof BILL_TYPE_SLUGS)[number];
const SLUG_TO_HEBREW: Record<BillTypeSlug, string> = {
  government: 'ממשלתית',
  private: 'פרטית',
  committee: 'ועדה',
};

interface Props {
  searchParams: Promise<{
    knesset?: string;
    type?: string;
    status?: string;
    search?: string;
    sort?: string;
    sortDir?: string;
    page?: string;
    stage?: string;
    dateFrom?: string;
    dateTo?: string;
    initiatorFaction?: string;
    initiatorMember?: string;
    committee?: string;
  }>;
}

const PAGE_SIZE = 50;

export const dynamic = 'force-dynamic';

function parseList(v?: string): number[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

export default async function LegislationPage({ searchParams }: Props) {
  const t = await getTranslations('legislation');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  const params = await searchParams;
  const knessetNum = params.knesset ? Number(params.knesset) : undefined;
  const billType = params.type ?? '';
  const statusFilter = params.status ?? '';
  const searchQuery = params.search ?? '';
  const rawSort = params.sort ?? '';
  // Back-compat: legacy `dateDesc` / `dateAsc` / `nameAsc` / `nameDesc` combined codes.
  let sortBy: string;
  let sortDir: 'asc' | 'desc';
  if (rawSort === 'dateAsc') {
    sortBy = 'date';
    sortDir = 'asc';
  } else if (rawSort === 'nameAsc') {
    sortBy = 'name';
    sortDir = 'asc';
  } else if (rawSort === 'nameDesc') {
    sortBy = 'name';
    sortDir = 'desc';
  } else {
    sortBy = rawSort || 'date';
    sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';
  }
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  const stages = parseList(params.stage);
  const dateFrom = params.dateFrom ?? '';
  const dateTo = params.dateTo ?? '';
  const initiatorFactionIds = parseList(params.initiatorFaction);
  const initiatorMemberIds = parseList(params.initiatorMember);
  const committeeIds = parseList(params.committee);

  const conditions = [];
  if (knessetNum) conditions.push(eq(bills.knessetNum, knessetNum));
  if (billType && billType in SLUG_TO_HEBREW)
    conditions.push(
      eq(bills.billType, SLUG_TO_HEBREW[billType as BillTypeSlug]),
    );
  if (statusFilter) conditions.push(eq(bills.status, statusFilter));
  if (searchQuery) {
    conditions.push(
      or(
        ilike(bills.name, `%${searchQuery}%`),
        exists(
          db
            .select({ one: sql`1` })
            .from(billNames)
            .where(
              and(
                eq(billNames.billId, bills.id),
                ilike(billNames.name, `%${searchQuery}%`),
              ),
            ),
        ),
      ),
    );
  }
  if (stages.length > 0) {
    conditions.push(inArray(bills.currentStage, stages));
  }
  if (dateFrom) conditions.push(gte(bills.proposedDate, dateFrom));
  if (dateTo) conditions.push(lte(bills.proposedDate, dateTo));
  if (committeeIds.length > 0) {
    conditions.push(inArray(bills.committeeId, committeeIds));
  }
  if (initiatorMemberIds.length > 0) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM bill_initiators bi
        WHERE bi.bill_id = ${bills.id} AND bi.member_id = ANY(${initiatorMemberIds})
      )`,
    );
  }
  if (initiatorFactionIds.length > 0) {
    // Members' current factionId (members.faction_id is latest; close enough for filter)
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM bill_initiators bi
        INNER JOIN members m ON m.id = bi.member_id
        WHERE bi.bill_id = ${bills.id} AND m.faction_id = ANY(${initiatorFactionIds})
      )`,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderByClause =
    sortBy === 'name'
      ? sortDir === 'asc'
        ? asc(bills.name)
        : desc(bills.name)
      : sortBy === 'stage'
        ? sortDir === 'asc'
          ? asc(bills.currentStage)
          : desc(bills.currentStage)
        : sortDir === 'asc'
          ? asc(bills.proposedDate)
          : desc(bills.proposedDate);

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: bills.id,
        knessetId: bills.knessetId,
        name: bills.name,
        status: bills.status,
        billType: bills.billType,
        subTypeId: bills.subTypeId,
        knessetNum: bills.knessetNum,
        proposedDate: bills.proposedDate,
        aiSummary: bills.aiSummary,
      })
      .from(bills)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bills)
      .where(whereClause),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Distinct statuses
  const rawStatuses = await db
    .selectDistinct({ status: bills.status })
    .from(bills)
    .where(sql`${bills.status} IS NOT NULL`)
    .orderBy(bills.status);
  const statusOptions = rawStatuses
    .filter((s) => s.status)
    .map((s) => ({
      value: s.status!,
      label: getBillStatusText(s.status),
    }));

  // Reference lists for advanced filters
  const [factionRows, memberRows, committeeRows] = await Promise.all([
    db
      .selectDistinct({ id: factions.id, name: factions.name })
      .from(factions)
      .where(sql`${factions.name} IS NOT NULL`)
      .orderBy(factions.name),
    db
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
      })
      .from(members)
      .where(
        sql`EXISTS (SELECT 1 FROM bill_initiators bi WHERE bi.member_id = ${members.id})`,
      )
      .orderBy(members.lastName, members.firstName),
    db
      .select({ id: committees.id, name: committees.name })
      .from(committees)
      .orderBy(committees.name),
  ]);

  const factionList = factionRows
    .filter((f) => f.name)
    .map((f) => ({ id: f.id, name: f.name! }));
  const memberList = memberRows.map((m) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`,
  }));
  const committeeList = committeeRows.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Gavel className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {totalCount.toLocaleString()} {t('title')}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <LegislationFilter
          billTypes={[...BILL_TYPE_SLUGS]}
          statusOptions={statusOptions}
          factions={factionList}
          members={memberList}
          committees={committeeList}
        />
      </div>

      {data.length > 0 ? (
        <>
          <div className="stagger-children space-y-3">
            {data.map((bill) => {
              const { specialStatus } = computeBillStage(
                bill.status,
                bill.subTypeId,
                bill.billType,
              );
              return (
                <div key={bill.id} className="group relative">
                  <Link href={`/legislation/${bill.id}`}>
                    <Card className="glass-card hover-lift border-s-primary/30 overflow-hidden border-s-4">
                      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="leading-tight font-semibold">
                            <TranslatedText text={bill.name} />
                          </h3>
                          <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                            {bill.proposedDate && (
                              <span>
                                {new Date(bill.proposedDate).toLocaleDateString(
                                  'he-IL',
                                )}
                              </span>
                            )}
                            {bill.knessetNum && (
                              <span>
                                • {t('knesset')} {bill.knessetNum}
                              </span>
                            )}
                          </div>
                          {bill.aiSummary && (
                            <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-relaxed">
                              <Sparkles className="me-1 inline h-3.5 w-3.5 text-amber-500" />
                              {bill.aiSummary[locale] ?? bill.aiSummary.he}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {specialStatus === 'merged' && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300"
                            >
                              <GitMerge className="h-3 w-3" />
                              {t('special.merged')}
                            </Badge>
                          )}
                          {specialStatus === 'split' && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300"
                            >
                              <GitBranch className="h-3 w-3" />
                              {t('special.split')}
                            </Badge>
                          )}
                          {specialStatus === 'stopped' && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                            >
                              <Pause className="h-3 w-3" />
                              {t('special.stopped')}
                            </Badge>
                          )}
                          {specialStatus === 'converted' && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300"
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                              {t('special.converted')}
                            </Badge>
                          )}
                          {bill.billType && (
                            <Badge variant="outline">
                              <TranslatedText text={bill.billType} />
                            </Badge>
                          )}
                          {bill.status && (
                            <Badge variant="secondary">
                              <TranslatedText
                                text={getBillStatusText(bill.status)}
                              />
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                  <div className="absolute inset-e-2 top-2 z-10">
                    <EntityActivityPopover
                      entityType="bill"
                      entityId={String(bill.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <PaginationNav
            currentPage={page}
            totalPages={totalPages}
            buildPageUrl={(p) => {
              const urlParams = new URLSearchParams();
              if (knessetNum) urlParams.set('knesset', String(knessetNum));
              if (billType) urlParams.set('type', billType);
              if (statusFilter) urlParams.set('status', statusFilter);
              if (searchQuery) urlParams.set('search', searchQuery);
              if (sortBy !== 'date') urlParams.set('sort', sortBy);
              if (sortDir !== 'desc') urlParams.set('sortDir', sortDir);
              if (params.stage) urlParams.set('stage', params.stage);
              if (dateFrom) urlParams.set('dateFrom', dateFrom);
              if (dateTo) urlParams.set('dateTo', dateTo);
              if (params.initiatorFaction)
                urlParams.set('initiatorFaction', params.initiatorFaction);
              if (params.initiatorMember)
                urlParams.set('initiatorMember', params.initiatorMember);
              if (params.committee)
                urlParams.set('committee', params.committee);
              if (p > 1) urlParams.set('page', String(p));
              const qs = urlParams.toString();
              return `/legislation${qs ? `?${qs}` : ''}`;
            }}
            previousLabel={tCommon('previous')}
            nextLabel={tCommon('next')}
          />
        </>
      ) : (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Gavel className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
