/**
 * Integrity case category taxonomy.
 *
 * Grouping shown in the public member profile (IntegrityTab):
 *   1. parliamentary_ethics — קובלנות ואתיקה של הכנסת
 *        ethics_complaint, immunity_request, disciplinary_action,
 *        conflict_of_interest, financial_disclosure_issue, comptroller_finding
 *   2. civil_lawsuits      — תביעות אזרחיות
 *        civil_lawsuit
 *   3. criminal            — תביעות פליליות
 *        criminal_investigation, indictment, criminal_indictment,
 *        criminal_conviction, regulatory_sanction
 *   4. non_parliamentary   — משפטים לא פרלמנטריים (שפה נבזית/קיצונית וכו')
 *        extreme_speech, public_incitement, misconduct_outside_knesset
 */
export const INTEGRITY_GROUPS = [
  'parliamentary_ethics',
  'civil_lawsuits',
  'criminal',
  'non_parliamentary',
] as const;

export type IntegrityGroup = (typeof INTEGRITY_GROUPS)[number];

const CATEGORY_TO_GROUP: Record<string, IntegrityGroup> = {
  ethics_complaint: 'parliamentary_ethics',
  immunity_request: 'parliamentary_ethics',
  disciplinary_action: 'parliamentary_ethics',
  conflict_of_interest: 'parliamentary_ethics',
  financial_disclosure_issue: 'parliamentary_ethics',
  comptroller_finding: 'parliamentary_ethics',

  civil_lawsuit: 'civil_lawsuits',

  criminal_investigation: 'criminal',
  indictment: 'criminal',
  criminal_indictment: 'criminal',
  criminal_conviction: 'criminal',
  regulatory_sanction: 'criminal',

  extreme_speech: 'non_parliamentary',
  public_incitement: 'non_parliamentary',
  misconduct_outside_knesset: 'non_parliamentary',
};

export function getIntegrityGroup(category: string): IntegrityGroup {
  return CATEGORY_TO_GROUP[category] ?? 'parliamentary_ethics';
}

/** Group integrity cases by their display group, preserving input order. */
export function groupIntegrityCases<T extends { category: string }>(
  cases: T[],
): Record<IntegrityGroup, T[]> {
  const out: Record<IntegrityGroup, T[]> = {
    parliamentary_ethics: [],
    civil_lawsuits: [],
    criminal: [],
    non_parliamentary: [],
  };
  for (const c of cases) out[getIntegrityGroup(c.category)].push(c);
  return out;
}
