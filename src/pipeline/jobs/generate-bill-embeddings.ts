import { embed } from 'ai';
import { sql, eq, isNull } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills, billEmbeddings } from '../../lib/db/schema';
import { appConfig } from '../../../app.config';
import { runSyncJob } from '../utils';

const BATCH_SIZE = 100;

/**
 * Get the embedding model based on configured provider.
 */
function getEmbeddingModel() {
  const provider = appConfig.ai.embeddingProvider;
  const model = appConfig.ai.embeddingModel;

  switch (provider) {
    case 'gemini': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { google } = require('@ai-sdk/google');
      return google.textEmbeddingModel(model);
    }
    case 'openai': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { openai } = require('@ai-sdk/openai');
      return openai.embedding(model);
    }
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}

/**
 * Build the text input for embedding a bill.
 * Combines name, type, and knesset number for better semantic matching.
 */
function buildEmbeddingInput(bill: {
  name: string;
  billType: string | null;
  knessetNum: number | null;
}): string {
  const parts = [bill.name];
  if (bill.billType) parts.push(`(${bill.billType})`);
  if (bill.knessetNum) parts.push(`כנסת ${bill.knessetNum}`);
  return parts.join(' ');
}

/**
 * Generate embeddings for all bills that don't have one yet.
 * Uses Gemini text-embedding-004 (768 dimensions) by default.
 */
export async function generateBillEmbeddings(): Promise<void> {
  await runSyncJob('generate-bill-embeddings', async () => {
    // Find bills without embeddings
    const billsWithoutEmbeddings = await db
      .select({
        id: bills.id,
        name: bills.name,
        billType: bills.billType,
        knessetNum: bills.knessetNum,
      })
      .from(bills)
      .leftJoin(billEmbeddings, eq(bills.id, billEmbeddings.billId))
      .where(isNull(billEmbeddings.id));

    console.log(
      `[generate-bill-embeddings] ${billsWithoutEmbeddings.length} bills need embeddings`,
    );

    if (billsWithoutEmbeddings.length === 0) return 0;

    const model = getEmbeddingModel();
    let totalGenerated = 0;

    for (let i = 0; i < billsWithoutEmbeddings.length; i += BATCH_SIZE) {
      const batch = billsWithoutEmbeddings.slice(i, i + BATCH_SIZE);
      const inputs = batch.map((b) => buildEmbeddingInput(b));

      try {
        // Generate embeddings for the batch
        const results = await Promise.all(
          inputs.map((input) =>
            embed({
              model,
              value: input,
            }),
          ),
        );

        // Insert embeddings into DB
        for (let j = 0; j < batch.length; j++) {
          const embeddingVector = results[j].embedding;

          await db.insert(billEmbeddings).values({
            billId: batch[j].id,
            embedding: embeddingVector,
            model: appConfig.ai.embeddingModel,
          });
        }

        totalGenerated += batch.length;
        console.log(
          `[generate-bill-embeddings] Generated ${Math.min(i + BATCH_SIZE, billsWithoutEmbeddings.length)}/${billsWithoutEmbeddings.length}`,
        );
      } catch (error) {
        console.error(
          `[generate-bill-embeddings] Failed batch at offset ${i}:`,
          error instanceof Error ? error.message : error,
        );
        // Continue with next batch
      }
    }

    return totalGenerated;
  });
}
