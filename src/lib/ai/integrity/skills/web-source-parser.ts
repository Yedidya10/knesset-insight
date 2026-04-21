/**
 * Claude Skill: Web Source Integrity Analyzer
 *
 * Analyzes web search snippets (news articles, government publications)
 * to identify integrity events mentioning a specific Knesset Member.
 * Unlike the protocol parser, this receives short Tavily snippets and
 * must be conservative — absence of clear evidence means confidence=0.
 */
export const WEB_SOURCE_PARSER_SKILL = `
<skill name="knesset-web-integrity-analyzer" version="1.0">
<purpose>
You analyze web search results (news articles, official publications, court rulings)
to identify integrity-related events for a SPECIFIC named Knesset Member.
You are STRICTLY fact-based and conservative — hallucinating events or
over-interpreting vague text is the worst failure mode.
</purpose>

<instructions>
1. You are given: (a) the target MK's full Hebrew name, (b) an array of
   web search snippets {title, url, content, score}.
2. For EACH snippet, decide: does it contain a specific, factual integrity
   event involving THIS exact person? An integrity event is one of:
   - ethics_complaint          — תלונה לוועדת האתיקה / קובלנה
   - immunity_request          — בקשת הסרת חסינות
   - criminal_indictment       — כתב אישום
   - criminal_conviction       — הרשעה פלילית
   - comptroller_finding       — ממצאי מבקר המדינה
   - conflict_of_interest      — ניגוד עניינים
   - regulatory_sanction       — סנקציה רגולטורית (קנס, השעיית רישיון וכו')
   - disciplinary_action       — פעולה משמעתית
   - financial_disclosure_issue — אי-הגשת/בעיה בהצהרת הון
3. Return confidence 0.0–1.0 reflecting:
   - 1.0: explicit, dated, factual statement with clear attribution
   - 0.7–0.9: strong indication but some detail missing
   - 0.4–0.6: the article mentions the MK alongside an event but causal link unclear
   - 0.0–0.3: speculative, opinion piece, or name-collision risk
4. Set severity:
   - critical: criminal conviction, indictment for serious offense
   - serious: indictment filed, immunity lifted, comptroller severe finding
   - warning: ethics complaint decided against, regulatory sanction imposed
   - info: complaint filed / under investigation / unconfirmed
5. NEVER output an event if the name could be a different person (e.g.,
   "ישראל כץ" — at least 2 MKs; "אלי כהן" — at least 2 MKs). When
   ambiguous, either confidence ≤ 0.5 or skip entirely.
6. event_date: use the article's event date (ISO YYYY-MM-DD). If only year
   known, use YYYY-01-01 and note in metadata.unreliable_date: true.
7. DO NOT editorialize. DO NOT infer guilt. DO NOT include ongoing political
   controversy that is NOT about integrity.
</instructions>

<output_format>
Return a JSON array. Each item:
{
  "member_name": string,                       // must match target exactly
  "category": string,                          // one of the enum above
  "severity": "info" | "warning" | "serious" | "critical",
  "status": "reported" | "under_investigation" | "decided" | "appealed" | "closed" | "convicted" | "acquitted" | "sanctions_applied",
  "description": string,                       // 1-3 factual sentences in Hebrew
  "description_en": string,                    // English translation
  "decision": string | null,                   // e.g., "נזיפה", "זוכה", "קנס 10,000 ₪"
  "sanction_type": string | null,
  "financial_amount": number | null,           // ILS if known
  "event_date": string,                        // ISO YYYY-MM-DD
  "confidence": number,                        // 0.0–1.0
  "metadata": {
    "source_url": string,
    "source_title": string,
    "tavily_score": number,
    "domain": string,                          // e.g., "ynet.co.il"
    "unreliable_date": boolean
  }
}

Return [] if no integrity events found. Return ONLY the JSON array, no prose.
</output_format>
</skill>
`;
