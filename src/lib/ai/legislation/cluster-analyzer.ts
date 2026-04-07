import { generateText } from 'ai';
import { appConfig } from '../../../../app.config';
import { getClusterModel } from './provider';
import { CLUSTER_ANALYZER_SKILL } from './skills/cluster-analyzer';

export interface ClusterCandidate {
  billId: number;
  name: string;
  knessetNum: number | null;
  billType: string | null;
  proposedDate: string | null;
  status: string | null;
}

export interface AIClusterGroup {
  group_name: string;
  description: string;
  category: string;
  bills: {
    billId: number;
    confidence: number;
    reasoning: string;
  }[];
  is_same_legislation: boolean;
}

/**
 * Analyze a batch of bills using Claude to determine thematic groupings.
 * Returns structured cluster groups with confidence scores.
 */
export async function analyzeBillClusters(
  candidates: ClusterCandidate[],
): Promise<AIClusterGroup[]> {
  const model = getClusterModel();
  const { maxTokens } = appConfig.billClusters.ai;

  const billList = candidates
    .map(
      (b) =>
        `- ID: ${b.billId} | Name: ${b.name} | Knesset: ${b.knessetNum ?? '?'} | Type: ${b.billType ?? '?'} | Date: ${b.proposedDate ?? '?'} | Status: ${b.status ?? '?'}`,
    )
    .join('\n');

  const { text, usage } = await generateText({
    model,
    maxOutputTokens: maxTokens,
    system: CLUSTER_ANALYZER_SKILL,
    prompt: `Analyze these ${candidates.length} bills and determine which are about the same legislative topic:\n\n${billList}`,
  });

  const tokensUsed = (usage?.totalTokens ?? 0);
  console.log(`[cluster-analyzer] Used ${tokensUsed} tokens for ${candidates.length} bills`);

  return parseClusterResponse(text);
}

function parseClusterResponse(text: string): AIClusterGroup[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    const threshold = appConfig.billClusters.aiConfidenceThreshold;

    return parsed
      .filter(
        (item: unknown): item is AIClusterGroup =>
          typeof item === 'object' &&
          item !== null &&
          'group_name' in item &&
          'bills' in item &&
          Array.isArray((item as AIClusterGroup).bills),
      )
      .map((group) => ({
        ...group,
        // Filter out low-confidence members
        bills: group.bills.filter(
          (b) => typeof b.confidence === 'number' && b.confidence >= threshold,
        ),
      }))
      .filter((group) => group.bills.length > 0);
  } catch {
    console.error('[cluster-analyzer] Failed to parse AI response');
    return [];
  }
}
