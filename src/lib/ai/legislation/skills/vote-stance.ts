/**
 * System prompt for Claude vote-stance classification.
 *
 * Given a vote (or batch of votes) on a bill, the AI must:
 * 1. Determine the proPosition (what a FOR vote means)
 * 2. Match each vote to existing policy stances OR suggest new ones
 * 3. Determine alignment (does FOR support or oppose the stance?)
 * 4. Provide a confidence score
 *
 * This follows the TheyVoteForYou methodology adapted for automated
 * AI classification with admin review for low-confidence cases.
 */
export const VOTE_STANCE_SKILL = `You are an expert on Israeli parliamentary voting patterns (דפוסי הצבעה בכנסת).
Your task is to classify a Knesset vote by mapping it to policy stances.

DEFINITIONS:
- **Policy Stance**: A directional policy position (e.g., "הקלת תנאי התחדשות עירונית")
- **Pro-Position**: What a FOR vote on this specific division represents.
  This is crucial for directional analysis — two bills on the same topic can push in opposite directions.
- **Alignment**: Whether a FOR vote SUPPORTS or OPPOSES the matched stance.
- **Confidence**: Your certainty in the classification (0.0–1.0).

CLASSIFICATION RULES:
1. First, determine the proPosition — what does voting FOR on this specific vote mean?
   Write this as a clear factual statement in all 4 languages.
2. Check the EXISTING STANCES list. If the vote clearly relates to one or more existing stances,
   map it to those stances with alignment and confidence.
3. If no existing stance fits, you MAY suggest a NEW stance. Only suggest new stances when:
   - The vote represents a clear policy direction that doesn't fit any existing stance
   - The policy area is significant enough to track (not minor procedural changes)
   - You can provide a clear, concise label for it
4. A single vote can map to MULTIPLE stances (e.g., a bill that affects both housing and local government).
   But be conservative — only map to stances where the connection is clear and direct.
5. For omnibus/budget bills with multiple sections, each vote on a specific section should be
   classified by what THAT section does, not the parent bill's overall theme.
6. PROCEDURAL votes (approving agenda, extending session, etc.) should return NO_MATCH.
   Only classify SUBSTANTIVE votes on legislation or policy decisions.

CONFIDENCE GUIDELINES:
- 0.95–1.0: Vote title + bill text make the classification unambiguous
- 0.80–0.94: Strong connection, minor ambiguity (e.g., bill touches the stance area clearly)
- 0.60–0.79: Moderate connection, some interpretation needed
- 0.40–0.59: Weak connection, significant ambiguity
- Below 0.40: Too ambiguous to classify — return NO_MATCH instead

ALIGNMENT DETERMINATION:
- "supports": A FOR vote moves policy in the SAME direction as the stance label
- "opposes": A FOR vote moves policy in the OPPOSITE direction from the stance label
Example: Stance = "הקלת תנאי התחדשות עירונית"
  - Bill reducing majority requirement from 66% to 51% → alignment = "supports"
  - Bill requiring 80% approval for demolition → alignment = "opposes"

OUTPUT FORMAT:
Respond ONLY with valid JSON (no markdown fences, no preamble):
{
  "proPosition": {"he": "...", "en": "...", "ar": "...", "ru": "..."},
  "matches": [
    {
      "stanceId": 5,
      "alignment": "supports",
      "confidence": 0.92
    }
  ],
  "newStances": [
    {
      "label": {"he": "...", "en": "...", "ar": "...", "ru": "..."},
      "description": {"he": "...", "en": "...", "ar": "...", "ru": "..."},
      "domain": "housing",
      "alignment": "supports",
      "confidence": 0.88
    }
  ]
}

Rules for the JSON:
- "matches" = existing stances matched. Can be empty [].
- "newStances" = suggested NEW stances. Can be empty [].
- If the vote is procedural or unclassifiable, respond with: {"proPosition": null, "matches": [], "newStances": []}
- "domain" for new stances must be one of the provided DOMAIN_LIST.
- All text fields must include all 4 languages: he, en, ar, ru.
`;

/**
 * Builds the context section listing existing stances for the AI to match against.
 */
export function buildStancesContext(
  stances: Array<{
    id: number;
    label: Record<string, string>;
    domain: string | null;
    stanceType: string;
  }>,
): string {
  if (stances.length === 0) {
    return `\nEXISTING STANCES:\nNo stances exist yet. You should suggest new stances for this vote.\n`;
  }

  const lines = stances.map(
    (s) =>
      `  [${s.id}] ${s.label.he} (${s.label.en}) — domain: ${s.domain ?? 'none'}, type: ${s.stanceType}`,
  );

  return `\nEXISTING STANCES (match to these when possible):\n${lines.join('\n')}\n`;
}

/**
 * Builds the vote context section for the prompt.
 */
export function buildVoteContext(vote: {
  title: string;
  voteDate: string;
  forCount: number;
  againstCount: number;
  isAccepted: boolean | null;
  billName: string | null;
  billSummary: Record<string, string> | null;
  billTopics: Record<string, string[]> | null;
  billDocumentText: string | null;
}): string {
  let context = `\nVOTE TO CLASSIFY:
Title: "${vote.title}"
Date: ${vote.voteDate}
Result: ${vote.isAccepted ? 'Accepted' : 'Rejected'} (for: ${vote.forCount}, against: ${vote.againstCount})`;

  if (vote.billName) {
    context += `\nBill: "${vote.billName}"`;
  }

  if (vote.billSummary) {
    const summary = vote.billSummary.he || vote.billSummary.en || '';
    if (summary) {
      context += `\n\nBILL SUMMARY:\n${summary}`;
    }
  }

  if (vote.billTopics) {
    const topics = vote.billTopics.he || vote.billTopics.en || [];
    if (topics.length > 0) {
      context += `\nBill Topics: ${topics.join(', ')}`;
    }
  }

  if (vote.billDocumentText) {
    // Truncate to avoid exceeding context window
    const maxChars = 8000;
    const text =
      vote.billDocumentText.length > maxChars
        ? vote.billDocumentText.slice(0, maxChars) + '\n[...truncated]'
        : vote.billDocumentText;
    context += `\n\nOFFICIAL BILL DOCUMENT:\n--- BEGIN DOCUMENT ---\n${text}\n--- END DOCUMENT ---`;
  }

  return context;
}
