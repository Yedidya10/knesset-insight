import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { eq, desc, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, parties } from '@/lib/db/schema';
import MemberCard from '@/components/members/MemberCard';
import MembersFilter from '@/components/members/MembersFilter';

interface Props {
  searchParams: Promise<{ party?: string; sort?: string }>;
}

export default async function MembersPage({ searchParams }: Props) {
  const t = await getTranslations('members');
  const params = await searchParams;
  const partyFilter = params.party ?? '';
  const sortBy = params.sort ?? 'name';

  // Fetch distinct parties that have current members (for filter dropdown)
  const partyList = await db
    .selectDistinct({
      id: parties.id,
      name: parties.name,
    })
    .from(parties)
    .innerJoin(members, eq(members.partyId, parties.id))
    .where(eq(members.isCurrent, true))
    .orderBy(parties.name);

  // Build member query
  const conditions = [eq(members.isCurrent, true)];
  if (partyFilter) {
    conditions.push(eq(members.partyId, Number(partyFilter)));
  }

  const orderBy =
    sortBy === 'party'
      ? [asc(parties.name), asc(members.lastName)]
      : [asc(members.lastName), asc(members.firstName)];

  const data = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
      isCurrent: members.isCurrent,
      isCoalition: members.isCoalition,
      partyId: members.partyId,
      partyName: parties.name,
      partyColor: parties.color,
    })
    .from(members)
    .leftJoin(parties, eq(members.partyId, parties.id))
    .where(sql.join(conditions, sql` AND `))
    .orderBy(...orderBy);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('currentMembers')} ({data.length})
          </p>
        </div>
      </div>

      <div className="mb-6">
        <MembersFilter
          parties={partyList}
          currentParty={partyFilter}
          currentSort={sortBy}
        />
      </div>

      {data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {data.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-2 text-muted-foreground">
          <Users className="h-12 w-12 opacity-20" />
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
