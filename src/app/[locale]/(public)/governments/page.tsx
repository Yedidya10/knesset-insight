import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Landmark } from 'lucide-react';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { governments, members, factionCoalitionPeriods } from '@/lib/db/schema';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import GovernmentCard from '@/components/governments/GovernmentCard';
import { appConfig } from '@/../app.config';

const ministerPosIds = appConfig.knesset.govPositionIds.minister;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.governments');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

interface Props {
  searchParams: Promise<{ knesset?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function GovernmentsPage({ searchParams }: Props) {
  const t = await getTranslations('governments');
  const params = await searchParams;
  const knessetFilter = params.knesset ? Number(params.knesset) : null;

  // Get distinct knesset numbers from governments
  const knessetNums = await db
    .selectDistinct({ knessetNum: governments.knessetNum })
    .from(governments)
    .orderBy(desc(governments.knessetNum));
  const availableKnessets = knessetNums.map((k) => k.knessetNum);

  // Fetch governments with PM info and stats
  const conditions = knessetFilter
    ? eq(governments.knessetNum, knessetFilter)
    : undefined;

  const rows = await db
    .select({
      id: governments.id,
      governmentNum: governments.governmentNum,
      knessetNum: governments.knessetNum,
      name: governments.name,
      startDate: governments.startDate,
      endDate: governments.endDate,
      pmFirstName: members.firstName,
      pmLastName: members.lastName,
      pmImageUrl: members.imageUrl,
      ministerCount: sql<number>`(
        select count(distinct gp.member_knesset_id)::int
        from government_positions gp
        where gp.government_id = ${governments.id}
          and gp.position_id in (${sql.join(
            ministerPosIds.map((id) => sql`${id}`),
            sql`, `,
          )})
      )`,
      activeMinisterCount: sql<number>`(
        select count(distinct gp.member_knesset_id)::int
        from government_positions gp
        where gp.government_id = ${governments.id}
          and gp.position_id in (${sql.join(
            ministerPosIds.map((id) => sql`${id}`),
            sql`, `,
          )})
          and gp.is_current = true
      )`,
      coalitionFactionCount: sql<number>`(
        select count(distinct fcp.faction_id)::int
        from faction_coalition_periods fcp
        where fcp.government_num = ${governments.governmentNum}
          and fcp.knesset_num = ${governments.knessetNum}
      )`,
    })
    .from(governments)
    .leftJoin(members, eq(governments.pmMemberId, members.id))
    .where(conditions)
    .orderBy(desc(governments.governmentNum));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Landmark className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
        </div>
      </div>

      {/* Knesset filter */}
      {availableKnessets.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/governments">
            <Badge
              variant={knessetFilter === null ? 'default' : 'outline'}
              className="cursor-pointer"
            >
              {t('allKnessets')}
            </Badge>
          </Link>
          {availableKnessets.map((kn) => (
            <Link key={kn} href={`/governments?knesset=${kn}`}>
              <Badge
                variant={knessetFilter === kn ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {kn === 0
                  ? t('provisionalStateCouncil')
                  : t('knessetNum', { num: kn })}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Government cards */}
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">{t('noData')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((gov) => (
            <GovernmentCard key={gov.id} government={gov} />
          ))}
        </div>
      )}
    </div>
  );
}
