import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { votes } from '@/lib/db/schema';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Legacy vote detail route — redirects to the parent bill page when possible,
 * otherwise falls back to /legislation.
 */
export default async function VoteRedirectPage({ params }: Props) {
  const { id } = await params;
  const voteId = Number(id);
  if (isNaN(voteId)) notFound();

  const [vote] = await db
    .select({ billId: votes.billId })
    .from(votes)
    .where(eq(votes.id, voteId))
    .limit(1);

  if (!vote) notFound();

  if (vote.billId) {
    redirect(`/legislation/${vote.billId}`);
  }

  redirect('/legislation');
}
