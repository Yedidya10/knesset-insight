import { useTranslations } from 'next-intl';
import { eq } from 'drizzle-orm';
import MemberCard from '../../../../components/members/MemberCard';
import { db } from '../../../../lib/db';
import { members, parties } from '../../../../lib/db/schema';

export default function MembersPage() {
  const t = useTranslations('members');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{t('title')}</h1>

      <p className="text-muted-foreground">
        {t('currentMembers')}
      </p>

      {/* Members grid will be populated once DB is connected */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {/* MemberCards will be rendered here after data sync */}
      </div>
    </div>
  );
}
