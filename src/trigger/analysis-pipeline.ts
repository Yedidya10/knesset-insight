/**
 * Trigger.dev scheduled task: Analysis Pipeline
 * Runs daily at 5 AM Israel time — links votes to bills, computes clusters,
 * generates embeddings, runs AI clustering, and generates summaries.
 * This is the heaviest set of jobs (AI calls, vector ops).
 * Depends on all sync jobs being up-to-date.
 */
import { schedules, logger } from '@trigger.dev/sdk';
import { linkVotesToBills } from '@/pipeline/jobs/link-votes-to-bills';
import { computeBillClusters } from '@/pipeline/jobs/compute-bill-clusters';
import { generateBillEmbeddings } from '@/pipeline/jobs/generate-bill-embeddings';
import { aiClusterBills } from '@/pipeline/jobs/ai-cluster-bills';
import { generateBillSummaries } from '@/pipeline/jobs/generate-bill-summaries';

export const analysisPipeline = schedules.task({
  id: 'analysis-pipeline',
  cron: {
    pattern: '0 5 * * *',
    timezone: 'Asia/Jerusalem',
  },
  maxDuration: 3600, // 1 hour — AI jobs can be slow
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 30_000,
    maxTimeoutInMs: 300_000,
  },
  queue: {
    concurrencyLimit: 1,
  },
  run: async () => {
    logger.info('Starting analysis pipeline');

    logger.info('Linking votes to bills...');
    await linkVotesToBills();

    logger.info('Computing bill clusters...');
    await computeBillClusters();

    logger.info('Generating bill embeddings...');
    await generateBillEmbeddings();

    logger.info('Running AI bill clustering...');
    await aiClusterBills();

    logger.info('Generating bill summaries...');
    await generateBillSummaries();

    logger.info('Analysis pipeline complete');
    return { success: true };
  },
});
