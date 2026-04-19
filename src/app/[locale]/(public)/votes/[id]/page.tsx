import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { eq, desc, sql, and } from 'drizzle-orm';
import type { Metadata } from 'next';
import { Vote } from 'lucide-react';
import { db } from '@/lib/db';
import {
  votes,
  bills,
  billClusters,
  billClusterMembers,
} from '@/lib/db/schema';
import { VoteDetailContent } from '@/components/votes/VoteDetailContent';
import AppBreadcrumb from '@/components/layout/AppBreadcrumb';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const voteId = Number(id);
  if (Number.isNaN(voteId)) return {};

  const [vote] = await db
    .select({ title: votes.title })
    .from(votes)
    .where(eq(votes.id, voteId))
    .limit(1);

  if (!vote) return {};

  const t = await getTranslations('seo.votes.detail');
  return {
    title: t('title', { name: vote.title }),
    description: t('description', { name: vote.title }),
    openGraph: {
      title: t('title', { name: vote.title }),
      description: t('description', { name: vote.title }),
    },
  };
}

export default async function VoteDetailPage({ params }: Props) {
  const { id } = await params;
  const voteId = Number(id);
  if (Number.isNaN(voteId)) notFound();

  const t = await getTranslations('votes');
  const tDetail = await getTranslations('votes.detail');
  const tNav = await getTranslations('nav');

  const result = await db
    .select({
      id: votes.id,
      knessetId: votes.knessetId,
      title: votes.title,
      voteDate: votes.voteDate,
      voteType: votes.voteType,
      knessetNum: votes.knessetNum,
      sessionId: votes.sessionId,
      sessItemId: votes.sessItemId,
      forCount: votes.forCount,
      againstCount: votes.againstCount,
      abstainCount: votes.abstainCount,
      isAccepted: votes.isAccepted,
      summary: votes.summary,
      billId: votes.billId,
      billName: bills.name,
    })
    .from(votes)
    .leftJoin(bills, eq(votes.billId, bills.id))
    .where(eq(votes.id, voteId))
    .limit(1);

  const vote = result[0];
  if (!vote) notFound();

  // Fetch related votes (same sessItemId)
  let relatedVotes: {
    id: number;
    title: string;
    isAccepted: boolean | null;
    forCount: number | null;
    againstCount: number | null;
  }[] = [];
  if (vote.sessItemId) {
    relatedVotes = await db
      .select({
        id: votes.id,
        title: votes.title,
        isAccepted: votes.isAccepted,
        forCount: votes.forCount,
        againstCount: votes.againstCount,
      })
      .from(votes)
      .where(
        and(
          eq(votes.sessItemId, vote.sessItemId),
          sql`${votes.id} != ${voteId}`,
        ),
      )
      .orderBy(desc(votes.voteDate));
  }

  const voteData = {
    ...vote,
    voteDate: vote.voteDate ? vote.voteDate.toISOString() : null,
    relatedVotes,
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <AppBreadcrumb
        items={[
          { label: tNav('home'), href: '/' },
          { label: tNav('votes'), href: '/votes' },
          { label: vote.title },
        ]}
      />

      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Vote className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {vote.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {tDetail('voteDetails')}
          </p>
        </div>
      </div>

      <VoteDetailContent vote={voteData} />
    </div>
  );
}
