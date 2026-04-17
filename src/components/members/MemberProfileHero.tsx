import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Building2, Mail, Phone, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MemberAvatar from '@/components/members/MemberAvatar';

interface MemberProfileHeroProps {
  member: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    email: string | null;
    phone: string | null;
    isCurrent: boolean | null;
    isCoalition: boolean | null;
    factionName: string | null;
    factionId: number | null;
    knessetNum: number | null;
  };
}

export default async function MemberProfileHero({
  member,
}: MemberProfileHeroProps) {
  const t = await getTranslations('members.profile');
  const tCommon = await getTranslations('common');

  return (
    <section className="relative overflow-hidden rounded-2xl">
      {/* Gradient background */}
      <div className="from-primary/20 via-chart-2/10 to-chart-4/10 absolute inset-0 bg-gradient-to-br" />
      <div className="from-background/80 to-background/40 absolute inset-0 bg-gradient-to-t" />

      <div className="relative px-6 pt-4 pb-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1.5 rounded-lg"
          render={<Link href="/members" />}
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          {tCommon('back')}
        </Button>

        {/* Hero content */}
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end sm:gap-6">
          {/* Avatar with glow */}
          <div className="relative shrink-0">
            <div className="from-primary/30 to-chart-2/20 absolute -inset-1.5 rounded-full bg-gradient-to-br blur-md" />
            <MemberAvatar
              member={member}
              size="xl"
              className="relative"
              ring="ring-4 ring-background"
              priority
            />
          </div>

          {/* Name & info */}
          <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
            <div className="text-center sm:text-start">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {member.firstName} {member.lastName}
              </h1>
              {member.factionName && (
                <Link
                  href={`/factions/${member.factionId}`}
                  className="text-primary mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {member.factionName}
                </Link>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {member.isCoalition !== null && (
                <Badge variant={member.isCoalition ? 'default' : 'secondary'}>
                  {member.isCoalition
                    ? t('coalitionMember')
                    : t('oppositionMember')}
                </Badge>
              )}
              {member.isCurrent === false && (
                <Badge variant="outline">{t('endDate')}</Badge>
              )}
              {member.knessetNum && (
                <Badge variant="outline" className="text-xs">
                  {t('knessetNum')}: {member.knessetNum}
                </Badge>
              )}
            </div>

            {/* Contact info */}
            {(member.email || member.phone) && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {member.email}
                  </a>
                )}
                {member.phone && (
                  <a
                    href={`tel:${member.phone}`}
                    className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {member.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
