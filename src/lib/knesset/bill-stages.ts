/**
 * Bill legislative stage mapping and computation.
 *
 * Maps Knesset OData StatusID values to canonical legislative stages,
 * handling different bill types (government, private, committee) and
 * special statuses (merged, split, stopped, converted).
 */

// ── Stage enum ──────────────────────────────────────────────────

export enum BillStage {
  SUBMITTED = 0,
  PRELIMINARY = 1,
  COMMITTEE_FIRST = 2,
  FIRST_READING = 3,
  COMMITTEE_SECOND = 4,
  SECOND_THIRD_READING = 5,
  PASSED = 6,
}

export type SpecialStatus =
  | 'merged'
  | 'split'
  | 'stopped'
  | 'converted'
  | 'continuityPending'
  | 'continuityRejected'
  | 'removedFromAgenda'
  | null;

export type StageStatus = 'completed' | 'current' | 'upcoming';

export interface StageInfo {
  stage: BillStage;
  /** i18n key suffix for this stage */
  key: string;
  status: StageStatus;
}

export interface ComputedBillStage {
  currentStage: BillStage;
  stages: StageInfo[];
  specialStatus: SpecialStatus;
}

// ── KNS_BillName NameHistoryTypeID → Stage mapping ──────────────
// Maps the official name-history types to the legislative stage they belong to.
// Used by link-votes-to-bills to assign bill_stage via name matching.

export const NAME_TYPE_TO_STAGE: Record<number, BillStage> = {
  5200: BillStage.PRELIMINARY,           // בדיון המוקדם
  5201: BillStage.FIRST_READING,         // בקריאה הראשונה
  5202: BillStage.SECOND_THIRD_READING,  // בקריאה השנייה והשלישית
  5203: BillStage.SECOND_THIRD_READING,  // לקריאה השלישית
  10062: BillStage.PASSED,               // לחוק שהתקבל
};

// ── StatusID → Stage mapping ────────────────────────────────────

const STATUS_TO_STAGE: Record<string, BillStage> = {
  // Stage 0: Submitted
  '104': BillStage.SUBMITTED,
  '141': BillStage.SUBMITTED,
  '130': BillStage.SUBMITTED,
  '131': BillStage.SUBMITTED,

  // Stage 1: Preliminary discussion (private bills only)
  '150': BillStage.PRELIMINARY,

  // Stage 2: Committee — preparation for first reading
  '106': BillStage.COMMITTEE_FIRST,
  '142': BillStage.COMMITTEE_FIRST,
  '101': BillStage.COMMITTEE_FIRST,
  '108': BillStage.COMMITTEE_FIRST,
  '109': BillStage.COMMITTEE_FIRST,
  '167': BillStage.COMMITTEE_FIRST,

  // Stage 3: First reading in plenum
  '111': BillStage.FIRST_READING,

  // Stage 4: Committee — preparation for 2nd+3rd reading
  '113': BillStage.COMMITTEE_SECOND,
  '178': BillStage.COMMITTEE_SECOND,
  '179': BillStage.COMMITTEE_SECOND,
  '115': BillStage.COMMITTEE_SECOND,

  // Stage 5: 2nd+3rd reading in plenum
  '114': BillStage.SECOND_THIRD_READING,
  '117': BillStage.SECOND_THIRD_READING,

  // Stage 6: Passed
  '118': BillStage.PASSED,
};

// ── Special status StatusIDs ────────────────────────────────────

const MERGED_STATUSES = new Set(['122', '126', '169']);
const SPLIT_STATUSES = new Set(['158', '161', '162', '165']);
const STOPPED_STATUSES = new Set(['177']);
const CONVERTED_STATUSES = new Set(['124']);
const CONTINUITY_PENDING_STATUSES = new Set(['120', '175', '181']);
const CONTINUITY_REJECTED_STATUSES = new Set(['110', '176']);
const REMOVED_STATUSES = new Set(['140', '143']);

// ── Stage keys for i18n ─────────────────────────────────────────

const STAGE_KEYS: Record<BillStage, string> = {
  [BillStage.SUBMITTED]: 'submitted',
  [BillStage.PRELIMINARY]: 'preliminary',
  [BillStage.COMMITTEE_FIRST]: 'committeeFirst',
  [BillStage.FIRST_READING]: 'firstReading',
  [BillStage.COMMITTEE_SECOND]: 'committeeSecond',
  [BillStage.SECOND_THIRD_READING]: 'secondThirdReading',
  [BillStage.PASSED]: 'passed',
};

// ── SubType constants ───────────────────────────────────────────

const BILL_SUBTYPE_GOVERNMENT = 53;
const BILL_SUBTYPE_COMMITTEE = 55;

// ── Visual pipelines per bill type ──────────────────────────────
// Matches the Knesset website stepper: SUBMITTED is never shown visually.
// Government (53): 4 stages — skips PRELIMINARY + COMMITTEE_FIRST
// Committee  (55): 5 stages — skips PRELIMINARY
// Private    (54): 6 stages — full except SUBMITTED

const GOVERNMENT_STAGES = [
  BillStage.FIRST_READING,
  BillStage.COMMITTEE_SECOND,
  BillStage.SECOND_THIRD_READING,
  BillStage.PASSED,
] as const;

const COMMITTEE_STAGES = [
  BillStage.COMMITTEE_FIRST,
  BillStage.FIRST_READING,
  BillStage.COMMITTEE_SECOND,
  BillStage.SECOND_THIRD_READING,
  BillStage.PASSED,
] as const;

const PRIVATE_STAGES = [
  BillStage.PRELIMINARY,
  BillStage.COMMITTEE_FIRST,
  BillStage.FIRST_READING,
  BillStage.COMMITTEE_SECOND,
  BillStage.SECOND_THIRD_READING,
  BillStage.PASSED,
] as const;

// ── Main computation ────────────────────────────────────────────

function getSpecialStatus(statusId: string): SpecialStatus {
  if (MERGED_STATUSES.has(statusId)) return 'merged';
  if (SPLIT_STATUSES.has(statusId)) return 'split';
  if (STOPPED_STATUSES.has(statusId)) return 'stopped';
  if (CONVERTED_STATUSES.has(statusId)) return 'converted';
  if (CONTINUITY_PENDING_STATUSES.has(statusId)) return 'continuityPending';
  if (CONTINUITY_REJECTED_STATUSES.has(statusId)) return 'continuityRejected';
  if (REMOVED_STATUSES.has(statusId)) return 'removedFromAgenda';
  return null;
}

/**
 * Determine the last completed stage for a special-status bill.
 * We infer based on the special status type.
 */
function inferStageForSpecialStatus(statusId: string): BillStage {
  // Merge can happen at various points — usually after committee first reading
  if (MERGED_STATUSES.has(statusId)) return BillStage.COMMITTEE_FIRST;
  // Split usually happens after first reading
  if (SPLIT_STATUSES.has(statusId)) return BillStage.FIRST_READING;
  // Continuity statuses — bill is in early stages (pre-pipeline)
  if (
    CONTINUITY_PENDING_STATUSES.has(statusId) ||
    CONTINUITY_REJECTED_STATUSES.has(statusId)
  )
    return BillStage.SUBMITTED;
  // Stopped/converted/removed — assume pre-pipeline
  return BillStage.SUBMITTED;
}

// ── BillType text → pipeline mapping (fallback when subTypeId is null) ──

const BILL_TYPE_TEXT_GOVERNMENT = new Set(['ממשלתית', 'government']);
const BILL_TYPE_TEXT_COMMITTEE = new Set(['ועדה', 'committee']);

/**
 * Select the visual stage pipeline for a bill type.
 * Uses subTypeId when available, falls back to billType text.
 */
function getVisualStages(
  subTypeId: number | null | undefined,
  billType: string | null | undefined,
): readonly BillStage[] {
  if (subTypeId === BILL_SUBTYPE_GOVERNMENT) return GOVERNMENT_STAGES;
  if (subTypeId === BILL_SUBTYPE_COMMITTEE) return COMMITTEE_STAGES;
  if (subTypeId != null) return PRIVATE_STAGES;

  // Fallback: use billType text when subTypeId is not populated
  const bt = billType?.trim().toLowerCase();
  if (bt && BILL_TYPE_TEXT_GOVERNMENT.has(bt)) return GOVERNMENT_STAGES;
  if (bt && BILL_TYPE_TEXT_COMMITTEE.has(bt)) return COMMITTEE_STAGES;
  return PRIVATE_STAGES;
}

/**
 * Compute the visual stage pipeline for a bill.
 *
 * The visual stepper mirrors the Knesset website:
 * - Government (53): 4 stages (first reading → passed)
 * - Committee  (55): 5 stages (committee prep → passed)
 * - Private    (54): 6 stages (preliminary → passed)
 *
 * @param statusId - The bill's current StatusID (as string)
 * @param subTypeId - The bill's SubTypeID (53=government, 54=private, 55=committee)
 * @param billType  - The bill's type description text (fallback when subTypeId is null)
 */
export function computeBillStage(
  statusId: string | null | undefined,
  subTypeId: number | null | undefined,
  billType?: string | null,
): ComputedBillStage {
  const sid = statusId ?? '';
  const specialStatus = getSpecialStatus(sid);

  // Determine current stage
  let currentStage: BillStage;
  if (specialStatus) {
    currentStage = inferStageForSpecialStatus(sid);
  } else {
    currentStage = STATUS_TO_STAGE[sid] ?? BillStage.SUBMITTED;
  }

  // Build visual stages array based on bill type
  const allStages = getVisualStages(subTypeId, billType);
  const firstVisibleStage = allStages[0];

  const stages: StageInfo[] = allStages.map((stage) => {
    let status: StageStatus;

    // If currentStage is before the first visible stage (e.g. SUBMITTED),
    // all visible stages are "upcoming"
    if (currentStage < firstVisibleStage) {
      status = 'upcoming';
    } else if (stage < currentStage) {
      status = 'completed';
    } else if (stage === currentStage) {
      // PASSED is the terminal stage — treat it as completed, not "current/pending"
      status =
        specialStatus || currentStage === BillStage.PASSED
          ? 'completed'
          : 'current';
    } else {
      status = 'upcoming';
    }
    return { stage, key: STAGE_KEYS[stage], status };
  });

  return { currentStage, stages, specialStatus };
}
