import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FileText, Users, Vote, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export default function BillDetailPage() {
  const t = useTranslations('legislation');
  const tCommon = useTranslations('common');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6" render={<Link href="/legislation" />}>
        {tCommon('back')}
      </Button>

      <Card className="mb-6 border-border/60 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t('billStatus')}: —</Badge>
          </div>
          <h1 className="text-xl font-bold sm:text-2xl">—</h1>

          <Separator className="my-4" />

          {/* Timeline placeholder */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{t('timeline')}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              {t('initiators')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
              <Users className="h-10 w-10 opacity-20" />
              <p className="text-sm">{tCommon('loading')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Vote className="h-5 w-5 text-primary" />
              {t('relatedVotes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
              <Vote className="h-10 w-10 opacity-20" />
              <p className="text-sm">{tCommon('loading')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
