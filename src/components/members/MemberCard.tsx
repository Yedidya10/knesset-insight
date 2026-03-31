import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MemberCardProps {
  member: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    partyId: number | null;
    partyName: string | null;
    partyColor: string | null;
    isCurrent: boolean | null;
    isCoalition: boolean | null;
  };
}

export default function MemberCard({ member }: MemberCardProps) {
  const t = useTranslations('members.profile');

  const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`;

  return (
    <Link href={`/members/${member.id}`}>
      <Card className="group h-full border-border/60 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
        <CardContent className="flex flex-col items-center gap-3 p-5">
          <Avatar className="h-20 w-20 border-2 border-border/60 transition-transform group-hover:scale-105">
            {member.imageUrl && <AvatarImage src={member.imageUrl} alt={`${member.firstName} ${member.lastName}`} />}
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h3 className="font-semibold leading-tight">
              {member.firstName} {member.lastName}
            </h3>

            {member.partyName && (
              <p className="mt-1 text-sm text-primary/80 hover:underline">
                <Link href={`/members?party=${member.partyId}`}>
                  {member.partyName}
                </Link>
              </p>
            )}
          </div>

          {member.isCoalition !== null && (
            <Badge variant={member.isCoalition ? 'default' : 'secondary'} className="text-xs">
              {member.isCoalition ? t('coalitionMember') : t('oppositionMember')}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
