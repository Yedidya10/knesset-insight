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
  // Continuity statuses — bill is in early stages
  if (CONTINUITY_PENDING_STATUSES.has(statusId) || CONTINUITY_REJECTED_STATUSES.has(statusId))
    return BillStage.SUBMITTED;
  // Stopped/converted/removed — assume submitted
  return BillStage.SUBMITTED;
}

/**
 * Compute the visual stage pipeline for a bill.
 *
 * @param statusId - The bill's current StatusID (as string)
 * @param subTypeId - The bill's SubTypeID (53=government, 54=private, 55=committee)
 */
export function computeBillStage(
  statusId: string | null | undefined,
  subTypeId: number | null | undefined,
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

  // Build stages array — skip PRELIMINARY for government/committee bills
  const skipPreliminary =
    subTypeId === BILL_SUBTYPE_GOVERNMENT || subTypeId === BILL_SUBTYPE_COMMITTEE;

  const allStages = skipPreliminary
    ? [
        BillStage.SUBMITTED,
        BillStage.COMMITTEE_FIRST,
        BillStage.FIRST_READING,
        BillStage.COMMITTEE_SECOND,
        BillStage.SECOND_THIRD_READING,
        BillStage.PASSED,
      ]
    : [
        BillStage.SUBMITTED,
        BillStage.PRELIMINARY,
        BillStage.COMMITTEE_FIRST,
        BillStage.FIRST_READING,
        BillStage.COMMITTEE_SECOND,
        BillStage.SECOND_THIRD_READING,
        BillStage.PASSED,
      ];

  const stages: StageInfo[] = allStages.map((stage) => {
    let status: StageStatus;
    if (stage < currentStage) {
      status = 'completed';
    } else if (stage === currentStage) {
      // PASSED is the terminal stage — treat it as completed, not "current/pending"
      status = specialStatus || currentStage === BillStage.PASSED ? 'completed' : 'current';
    } else {
      status = 'upcoming';
    }
    return { stage, key: STAGE_KEYS[stage], status };
  });

  return { currentStage, stages, specialStatus };
}
