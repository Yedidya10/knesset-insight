import { generateText } from 'ai';
import { appConfig } from '../../../../app.config';
import { getIntegrityModel } from './provider';
import { PROTOCOL_PARSER_SKILL } from './skills/protocol-parser';
import { COMPTROLLER_ANALYZER_SKILL } from './skills/comptroller-analyzer';

export interface ExtractedIntegrityEvent {
  member_name: string;
  category: string;
  severity?: string;
  status?: string;
  description: string;
  description_en: string;
  decision: string | null;
  sanction_type?: string | null;
  financial_amount?: number | null;
  event_date: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Analyze a Knesset committee protocol for integrity events using Claude.
 */
export async function analyzeProtocol(
  protocolText: string,
  sessionMeta: { committeeName: string; date: string; sessionId: string },
  knownMemberNames?: string[],
): Promise<ExtractedIntegrityEvent[]> {
  const model = getIntegrityModel();
  const { maxTokens } = appConfig.integrity.ai;

  const memberList = knownMemberNames
    ? `\nKnown MK names for cross-reference:\n${knownMemberNames.join('\n')}`
    : '';

  const { text } = await generateText({
    model,
    maxOutputTokens: maxTokens,
    system: PROTOCOL_PARSER_SKILL,
    prompt: `Analyze the following Knesset committee protocol and extract integrity events.

Session metadata:
- Committee: ${sessionMeta.committeeName}
- Date: ${sessionMeta.date}
- Session ID: ${sessionMeta.sessionId}
${memberList}

Protocol text:
${protocolText}`,
  });

  return parseJsonResponse(text);
}

/**
 * Analyze a State Comptroller report for integrity findings using Claude.
 */
export async function analyzeComptrollerReport(
  reportText: string,
  reportMeta: { title: string; date: string; reportId: string },
  knownMemberNames?: string[],
): Promise<ExtractedIntegrityEvent[]> {
  const model = getIntegrityModel();
  const { maxTokens } = appConfig.integrity.ai;

  const memberList = knownMemberNames
    ? `\nKnown MK names for cross-reference:\n${knownMemberNames.join('\n')}`
    : '';

  const { text } = await generateText({
    model,
    maxOutputTokens: maxTokens,
    system: COMPTROLLER_ANALYZER_SKILL,
    prompt: `Analyze the following State Comptroller report excerpt and extract findings related to Knesset members.

Report metadata:
- Title: ${reportMeta.title}
- Date: ${reportMeta.date}
- Report ID: ${reportMeta.reportId}
${memberList}

Report text:
${reportText}`,
  });

  return parseJsonResponse(text);
}

function parseJsonResponse(text: string): ExtractedIntegrityEvent[] {
  // Extract JSON array from response (may have surrounding text)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is ExtractedIntegrityEvent =>
        typeof item === 'object' &&
        item !== null &&
        'member_name' in item &&
        'category' in item &&
        'event_date' in item &&
        'confidence' in item,
    );
  } catch {
    return [];
  }
}
