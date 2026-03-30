import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface MemberCardProps {
  member: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    partyName: string | null;
    partyColor: string | null;
    isCurrent: boolean | null;
    isCoalition: boolean | null;
  };
}

export default function MemberCard({ member }: MemberCardProps) {
  const t = useTranslations('members.profile');

  return (
    <Link
      href={`/members/${member.id}`}
      className="flex flex-col items-center rounded-lg border border-border p-4 transition-colors hover:bg-accent"
    >
      <div className="mb-3 h-20 w-20 overflow-hidden rounded-full bg-muted">
        {member.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.imageUrl}
            alt={`${member.firstName} ${member.lastName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">
            {member.firstName?.[0]}
            {member.lastName?.[0]}
          </div>
        )}
      </div>

      <h3 className="text-center font-semibold">
        {member.firstName} {member.lastName}
      </h3>

      {member.partyName && (
        <span className="mt-1 text-sm text-muted-foreground">
          {member.partyName}
        </span>
      )}

      {member.isCoalition !== null && (
        <span
          className={`mt-1 rounded-full px-2 py-0.5 text-xs ${
            member.isCoalition
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
          }`}
        >
          {member.isCoalition
            ? t('coalitionMember')
            : t('oppositionMember')}
        </span>
      )}
    </Link>
  );
}
