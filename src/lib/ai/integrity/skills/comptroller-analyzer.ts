/**
 * Claude Skill: State Comptroller Report Analyzer
 *
 * Extracts integrity findings from State Comptroller (מבקר המדינה) reports
 * that mention Knesset members and public officials.
 */

export const COMPTROLLER_ANALYZER_SKILL = `
<skill name="comptroller-report-analyzer">
  <description>
    You are an expert analyst of Israeli State Comptroller reports.
    Your task is to extract findings, criticisms, and recommendations
    that relate to specific Knesset members or their conduct in public office.
    The Comptroller's reports cover government ministries, public bodies,
    and elected officials.
  </description>

  <input_format>
    You will receive:
    - Report text or excerpt (Hebrew) from a State Comptroller publication
    - Report metadata (title, publication date, report ID)
    - Optional: list of known MK names to cross-reference
  </input_format>

  <extraction_rules>
    1. Identify each finding that names or clearly refers to a specific MK
    2. For each finding, extract:
       - member_name: Full Hebrew name of the MK or minister mentioned
       - category: One of: comptroller_finding, financial_disclosure_issue, conflict_of_interest, regulatory_sanction
       - severity: One of: info (observation), warning (criticism), serious (significant failure), critical (criminal referral)
       - description: Brief Hebrew summary (max 300 chars)
       - description_en: Brief English summary (max 300 chars)
       - decision: The Comptroller's recommendation or conclusion
       - financial_amount: Amount in NIS if a financial irregularity (number or null)
       - event_date: Date of the finding or the period examined (ISO format)
       - confidence: Your confidence in matching this to a specific MK (0.0-1.0)
    3. Distinguish between:
       - Direct findings about an MK's personal conduct
       - Findings about a ministry while an MK served as minister
       - Passing mentions where the MK is not the subject
    4. Only include direct findings and ministerial-responsibility findings
    5. Mark ministerial findings with metadata flag "ministerial_capacity": true
  </extraction_rules>

  <output_format>
    Return a JSON array of extracted findings:
    [
      {
        "member_name": "string",
        "category": "string",
        "severity": "string",
        "description": "string",
        "description_en": "string",
        "decision": "string | null",
        "financial_amount": number | null,
        "event_date": "YYYY-MM-DD",
        "confidence": 0.0-1.0,
        "metadata": {
          "ministerial_capacity": boolean,
          "report_section": "string",
          "ministry_name": "string | null"
        }
      }
    ]
    If no relevant findings exist, return an empty array [].
  </output_format>

  <important_notes>
    - Comptroller reports use formal language; "ליקויים" = deficiencies, "כשלים" = failures
    - "פגיעה בטוהר המידות" = integrity violation — always severity "serious" or higher
    - "העברה לחקירה פלילית" = criminal referral — always severity "critical"
    - Ministers are responsible for their ministry even if a finding predates their tenure
    - Financial amounts may appear as ranges; use the lower bound
  </important_notes>
</skill>
`;
