import { generateText } from 'ai';
import { appConfig } from '../../../../app.config';
import {
  VOTE_STANCE_SKILL,
  buildStancesContext,
  buildVoteContext,
} from './skills/vote-stance';
import { POLICY_DOMAIN_LIST } from '../../knesset/policy-domains';

/**
 * Returns the Anthropic Claude model instance for vote-stance classification.
 */
function getStanceModel() {
  const { createAnthropic } = require('@ai-sdk/anthropic');
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY,
  });
  return anthropic(appConfig.policyStances.ai.model);
}

// ── Types ────────────────────────────────────────────────

export interface VoteForClassification {
  voteId: number;
  title: string;
  voteDate: string;
  forCount: number;
  againstCount: number;
  isAccepted: boolean | null;
  billId: number | null;
  billName: string | null;
  billSummary: Record<string, string> | null;
  billTopics: Record<string, string[]> | null;
  billDocumentText: string | null;
}

export interface ExistingStance {
  id: number;
  label: Record<string, string>;
  domain: string | null;
  stanceType: string;
}

interface StanceMatch {
  stanceId: number;
  alignment: 'supports' | 'opposes';
  confidence: number;
}

interface NewStanceSuggestion {
  label: Record<string, string>;
  description: Record<string, string>;
  domain: string;
  alignment: 'supports' | 'opposes';
  confidence: number;
}

export interface ClassificationResult {
  voteId: number;
  proPosition: Record<string, string> | null;
  matches: StanceMatch[];
  newStances: NewStanceSuggestion[];
  tokensUsed: number;
}

// ── JSON Extraction ──────────────────────────────────────

function extractJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ── Validation ───────────────────────────────────────────

function isValidLocaleRecord(obj: unknown): obj is Record<string, string> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    typeof (obj as Record<string, string>).he === 'string'
  );
}

function isValidAlignment(val: unknown): val is 'supports' | 'opposes' {
  return val === 'supports' || val === 'opposes';
}

function isValidDomain(val: unknown): boolean {
  return typeof val === 'string' && POLICY_DOMAIN_LIST.includes(val as never);
}

// ── Main classifier ──────────────────────────────────────

/**
 * Classify a single vote against existing policy stances.
 * Returns matched stances, alignment direction, confidence, and optional new stance suggestions.
 */
export async function classifyVoteStance(
  vote: VoteForClassification,
  existingStances: ExistingStance[],
): Promise<ClassificationResult> {
  const model = getStanceModel();
  const { maxTokens } = appConfig.policyStances.ai;

  const stancesContext = buildStancesContext(existingStances);
  const voteContext = buildVoteContext({
    title: vote.title,
    voteDate: vote.voteDate,
    forCount: vote.forCount,
    againstCount: vote.againstCount,
    isAccepted: vote.isAccepted,
    billName: vote.billName,
    billSummary: vote.billSummary,
    billTopics: vote.billTopics,
    billDocumentText: vote.billDocumentText,
  });

  const domainList = POLICY_DOMAIN_LIST.join(', ');
  const prompt = `${stancesContext}

VALID DOMAINS (use one of these for new stances): ${domainList}

${voteContext}

Classify this vote. Map it to existing stances where applicable, or suggest new ones if needed.`;

  const { text, usage } = await generateText({
    model,
    maxOutputTokens: maxTokens,
    system: VOTE_STANCE_SKILL,
    prompt,
  });

  const tokensUsed = usage?.totalTokens ?? 0;
  const trimmed = text.trim();

  // Parse response
  const parsed = extractJson(trimmed) as Record<string, unknown> | null;
  if (!parsed) {
    console.warn(
      `[stance-classifier] Failed to parse JSON for vote ${vote.voteId}: ${trimmed.slice(0, 200)}`,
    );
    return {
      voteId: vote.voteId,
      proPosition: null,
      matches: [],
      newStances: [],
      tokensUsed,
    };
  }

  // Extract proPosition
  let proPosition: Record<string, string> | null = null;
  if (isValidLocaleRecord(parsed.proPosition)) {
    proPosition = parsed.proPosition as Record<string, string>;
  }

  // No classification (procedural vote)
  if (!proPosition) {
    return {
      voteId: vote.voteId,
      proPosition: null,
      matches: [],
      newStances: [],
      tokensUsed,
    };
  }

  // Extract matches
  const matches: StanceMatch[] = [];
  const existingStanceIds = new Set(existingStances.map((s) => s.id));

  if (Array.isArray(parsed.matches)) {
    for (const m of parsed.matches) {
      const match = m as Record<string, unknown>;
      const stanceId = Number(match.stanceId);
      if (
        existingStanceIds.has(stanceId) &&
        isValidAlignment(match.alignment) &&
        typeof match.confidence === 'number' &&
        match.confidence >= 0.4
      ) {
        matches.push({
          stanceId,
          alignment: match.alignment,
          confidence: Math.min(1, Math.max(0, match.confidence)),
        });
      }
    }
  }

  // Extract new stance suggestions
  const newStances: NewStanceSuggestion[] = [];

  if (Array.isArray(parsed.newStances)) {
    for (const ns of parsed.newStances) {
      const suggestion = ns as Record<string, unknown>;
      if (
        isValidLocaleRecord(suggestion.label) &&
        isValidLocaleRecord(suggestion.description) &&
        isValidDomain(suggestion.domain) &&
        isValidAlignment(suggestion.alignment) &&
        typeof suggestion.confidence === 'number' &&
        suggestion.confidence >= 0.4
      ) {
        newStances.push({
          label: suggestion.label as Record<string, string>,
          description: suggestion.description as Record<string, string>,
          domain: suggestion.domain as string,
          alignment: suggestion.alignment,
          confidence: Math.min(1, Math.max(0, suggestion.confidence)),
        });
      }
    }
  }

  console.log(
    `[stance-classifier] Vote ${vote.voteId}: proPosition="${proPosition.he?.slice(0, 60)}" ` +
      `matches=${matches.length} newStances=${newStances.length} [${tokensUsed} tokens]`,
  );

  return {
    voteId: vote.voteId,
    proPosition,
    matches,
    newStances,
    tokensUsed,
  };
}
