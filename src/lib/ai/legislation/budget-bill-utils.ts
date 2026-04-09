/**
 * Utilities for detecting and classifying budget/economic-plan omnibus bills.
 *
 * Israeli budget legislation comes in two forms:
 * 1. **Parent / Omnibus bills** — the full economic plan or budget act
 *    (e.g., "חוק התוכנית הכלכלית (תיקוני חקיקה ליישום המדיניות הכלכלית לשנות התקציב 2023 ו-2024)")
 * 2. **Split chapters** — individual chapters/sections split from the omnibus
 *    per Knesset Rule 84(b). Each becomes a separate bill entry in the DB.
 *    (e.g., "פרק ה' (גמישות ניהולית במערכת החינוך) מתוך הצעת חוק התכנית הכלכלית...")
 *
 * The AI needs to classify split chapters by their ACTUAL policy area
 * (e.g., "education" / "energy" / "healthcare") — NOT just "economic plan".
 */

/** Patterns that identify economic-plan / budget omnibus legislation */
const OMNIBUS_PATTERNS = [
  'חוק התוכנית הכלכלית',
  'חוק התכנית הכלכלית',
  'חוק ההסדרים',
  'חוק ההתייעלות הכלכלית',
  'חוק התקציב',
  'יעדי התקציב',
  'יסודות התקציב',
] as const;

/** Keyword that indicates this bill is a split chapter from an omnibus bill */
const SPLIT_MARKER = 'מתוך';

export type BudgetBillType = 'parent' | 'chapter' | null;

/**
 * Detect whether a bill is a budget/economic-plan bill and its sub-type.
 * - `'parent'`  — the original omnibus bill (or an amendment to one)
 * - `'chapter'` — a split chapter/section extracted from an omnibus bill
 * - `null`      — not a budget-related bill
 */
export function detectBudgetBillType(billName: string): BudgetBillType {
  const isOmnibus = OMNIBUS_PATTERNS.some((p) => billName.includes(p));
  if (!isOmnibus) return null;

  // Split chapters contain "מתוך" (from) referencing the parent omnibus
  if (billName.includes(SPLIT_MARKER)) return 'chapter';

  return 'parent';
}

/**
 * Extract the chapter topic hint from a split-chapter bill name.
 * E.g., "פרק ה' (גמישות ניהולית במערכת החינוך) מתוך ..." → "גמישות ניהולית במערכת החינוך"
 * E.g., "סעיפים 61, 62 (חוק מע"מ) מתוך ..." → "חוק מע\"מ"
 */
export function extractChapterTopic(billName: string): string | null {
  // Look for content inside parentheses before "מתוך"
  const beforeSplit = billName.split(SPLIT_MARKER)[0];
  if (!beforeSplit) return null;

  // Try to extract from parentheses — multiple may exist, get the most descriptive one
  const parenMatches = [...beforeSplit.matchAll(/\(([^)]+)\)/g)];
  if (parenMatches.length > 0) {
    // Return the longest match (usually the most descriptive)
    const initial = parenMatches[0][1];
    return parenMatches.reduce(
      (longest, m) => (m[1].length > longest.length ? m[1] : longest),
      initial,
    );
  }

  // Fallback: return everything before "מתוך" trimmed
  const trimmed = beforeSplit.trim();
  return trimmed.length > 5 ? trimmed : null;
}
