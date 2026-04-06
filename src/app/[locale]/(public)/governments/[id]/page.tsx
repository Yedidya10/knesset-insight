import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowRight, Landmark } from 'lucide-react';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  governments,
  governmentPositions,
  govMinistries,
  members,
  factions,
  factionCoalitionPeriods,
} from '@/lib/db/schema';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import MemberAvatar from '@/components/members/MemberAvatar';
import GovernmentComposition from '@/components/governments/GovernmentComposition';
import CoalitionBreakdown from '@/components/governments/CoalitionBreakdown';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GovernmentDetailPage({ params }: Props) {
  const t = await getTranslations('governments');
  const { id } = await params;
  const governmentNum = Number(id);

  if (Number.isNaN(governmentNum)) notFound();

  // Fetch government record
  const gov = await db
    .select()
    .from(governments)
    .where(eq(governments.governmentNum, governmentNum))
    .limit(1);

  if (!gov[0]) notFound();

  const govRecord = gov[0];

  // Fetch PM info
  let pmInfo: { id: number; firstName: string; lastName: string; imageUrl: string | null } | null =
    null;
  if (govRecord.pmMemberId) {
    const pm = await db
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        imageUrl: members.imageUrl,
      })
      .from(members)
      .where(eq(members.id, govRecord.pmMemberId))
      .limit(1);
    pmInfo = pm[0] ?? null;
  }

  // Fetch alternate PM info
  let alternatePmInfo: typeof pmInfo = null;
  if (govRecord.alternatePmMemberId) {
    const altPm = await db
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        imageUrl: members.imageUrl,
      })
      .from(members)
      .where(eq(members.id, govRecord.alternatePmMemberId))
      .limit(1);
    alternatePmInfo = altPm[0] ?? null;
  }

  // Fetch all positions with member and ministry info
  const positions = await db
    .select({
      id: governmentPositions.id,
      memberKnessetId: governmentPositions.memberKnessetId,
      positionId: governmentPositions.positionId,
      positionDesc: governmentPositions.positionDesc,
      factionKnessetId: governmentPositions.factionKnessetId,
      startDate: governmentPositions.startDate,
      endDate: governmentPositions.endDate,
      isCurrent: governmentPositions.isCurrent,
      memberId: members.id,
      memberFirstName: members.firstName,
      memberLastName: members.lastName,
      memberImageUrl: members.imageUrl,
      ministryId: govMinistries.id,
      ministryKnessetId: govMinistries.knessetId,
      ministryName: govMinistries.name,
    })
    .from(governmentPositions)
    .leftJoin(members, eq(governmentPositions.memberId, members.id))
    .leftJoin(
      govMinistries,
      eq(governmentPositions.govMinistryId, govMinistries.id),
    )
    .where(eq(governmentPositions.governmentId, govRecord.id))
    .orderBy(governmentPositions.positionId, governmentPositions.startDate);

  // Fetch coalition factions
  const coalitionFactions = await db
    .select({
      factionId: factions.id,
      factionName: factions.name,
      factionSeats: factions.seats,
      factionColor: factions.color,
      factionLogoUrl: factions.logoUrl,
      periodStart: factionCoalitionPeriods.startDate,
      periodEnd: factionCoalitionPeriods.endDate,
    })
    .from(factionCoalitionPeriods)
    .innerJoin(factions, eq(factionCoalitionPeriods.factionId, factions.id))
    .where(
      and(
        eq(factionCoalitionPeriods.governmentNum, governmentNum),
        eq(factionCoalitionPeriods.knessetNum, govRecord.knessetNum),
      ),
    );

  const isCurrent = !govRecord.endDate;
  const dateRange = govRecord.startDate
    ? `${govRecord.startDate}${govRecord.endDate ? ` — ${govRecord.endDate}` : ''}`
    : '';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <Link
        href="/governments"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        {t('backToList')}
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* PM avatar */}
        {pmInfo && (
          <Link href={`/members/${pmInfo.id}`}>
            <MemberAvatar
              member={{
                firstName: pmInfo.firstName,
                lastName: pmInfo.lastName,
                imageUrl: pmInfo.imageUrl,
              }}
              size="xl"
              ring="ring-2 ring-primary/30"
            />
          </Link>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t('governmentNum', { num: govRecord.governmentNum })}
            </h1>
            {isCurrent && <Badge variant="default">{t('current')}</Badge>}
            <Badge variant="outline">
              {t('knessetNum', { num: govRecord.knessetNum })}
            </Badge>
          </div>

          {/* PM name */}
          {pmInfo && (
            <p className="mt-2 text-lg text-muted-foreground">
              {t('primeMinister')}:{' '}
              <Link
                href={`/members/${pmInfo.id}`}
                className="font-medium text-foreground hover:text-primary transition-colors"
              >
                {pmInfo.firstName} {pmInfo.lastName}
              </Link>
            </p>
          )}

          {/* Alternate PM */}
          {alternatePmInfo && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('alternatePm')}:{' '}
              <Link
                href={`/members/${alternatePmInfo.id}`}
                className="font-medium text-foreground hover:text-primary transition-colors"
              >
                {alternatePmInfo.firstName} {alternatePmInfo.lastName}
              </Link>
            </p>
          )}

          {/* Date range */}
          {dateRange && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('dateRange')}: {dateRange}
            </p>
          )}

          {/* Stats */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              {t('ministerCount', {
                count: new Set(positions.map((p) => p.memberKnessetId)).size,
              })}
            </Badge>
            {coalitionFactions.length > 0 && (
              <Badge variant="secondary">
                {coalitionFactions.length} {t('coalitionFactions')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Composition */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">{t('composition')}</h2>
        <GovernmentComposition positions={positions} />
      </section>

      {/* Coalition Breakdown */}
      <section className="mb-8">
        <CoalitionBreakdown factions={coalitionFactions} />
      </section>
    </div>
  );
}
