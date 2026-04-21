import type {
  ODataVoteHeader,
  ODataMemberVote,
  OKnessetMember,
  ODataV4PlenumVoteResult,
} from './types';
import { classifyVoteActivity } from '../votes/activity-type';
import { computeBillStage } from './bill-stages';

/**
 * Map OData v4 PlenumVoteResult ResultCode to English enum value.
 * v4 codes: 6=present (didn't vote), 7=for, 8=against, 9=abstain, 11=voted (secret ballot)
 */
export function mapV4ResultCode(
  resultCode: number,
): 'for' | 'against' | 'abstain' | 'absent' | 'present' | 'voted' {
  switch (resultCode) {
    case 6:
      return 'present';
    case 7:
      return 'for';
    case 8:
      return 'against';
    case 9:
      return 'abstain';
    case 11:
      return 'voted';
    default:
      return 'absent';
  }
}

/**
 * Map numeric vote result to English enum value.
 */
export function mapVoteValue(
  result: number,
): 'for' | 'against' | 'abstain' | 'absent' {
  switch (result) {
    case 1:
      return 'for';
    case 2:
      return 'against';
    case 3:
      return 'abstain';
    default:
      return 'absent';
  }
}

/**
 * Transform OData vote header to our votes table shape.
 */
/** Generic vote titles that should be enriched with the session item description */
const GENERIC_VOTE_TITLES = new Set([
  'הסתייגות',
  'להעביר את הצעת החוק לוועדה',
  'קריאה שנייה',
  'אישור החוק',
  'הצעת ועדה',
  'הצעת ועדת הכנסת',
  'להעביר את הנושא לוועדה',
  'הצבעה',
  'שם החוק',
  'להעביר את הצעת החוק לוועדה שתקבע ועדת הכנסת',
  'העברת הנושא לוועדה שתקבע ועדת הכנסת',
  'להחיל דין רציפות',
]);

export function transformVoteHeader(raw: ODataVoteHeader) {
  // Build enriched title: prepend sess_item_dscr when vote_item_dscr is generic
  let title = raw.vote_item_dscr;
  if (
    raw.sess_item_dscr?.trim() &&
    GENERIC_VOTE_TITLES.has(raw.vote_item_dscr.trim())
  ) {
    title = `${raw.sess_item_dscr.trim()} — ${raw.vote_item_dscr.trim()}`;
  }
  return {
    knessetId: raw.vote_id,
    title,
    voteDate: new Date(raw.vote_date),
    voteType: String(raw.vote_type),
    knessetNum: raw.knesset_num,
    sessionId: raw.session_id ? Number(raw.session_id) : null,
    sessItemId: raw.sess_item_id ?? null,
    forCount: raw.total_for,
    againstCount: raw.total_against,
    abstainCount: raw.total_abstain,
    isAccepted: raw.is_accepted === 1,
    isReservation: /הסתייגו/.test(title),
    // Pre-classify activity type from title alone; link-votes-to-bills later
    // upgrades rows to "bill" when it resolves a billId.
    activityType: classifyVoteActivity(title, null),
  };
}

/**
 * Transform OData member vote to our member_votes table shape.
 */
export function transformMemberVote(raw: ODataMemberVote) {
  return {
    voteKnessetId: raw.vote_id,
    memberKnessetId: raw.kmmbr_id,
    voteValue: mapVoteValue(raw.vote_result),
  };
}

/**
 * Transform Open Knesset member CSV row to our members table shape.
 */
export function transformOKnessetMember(raw: OKnessetMember) {
  const photo = raw.mk_individual_photo || null;
  const hasRealPhoto = photo && !photo.includes('placeholder');
  return {
    knessetId: raw.mk_individual_id,
    firstName: raw.mk_individual_first_name,
    lastName: raw.mk_individual_name,
    isCurrent: raw.mk_individual_is_current,
    gender: raw.mk_individual_gender,
    birthDate: raw.mk_individual_date_of_birth || null,
    imageUrl: hasRealPhoto ? photo : null,
    imageSource: hasRealPhoto ? ('oknesset' as const) : null,
    imageAttribution: hasRealPhoto ? 'כנסת פתוחה — הסדנא לידע ציבורי' : null,
    email: raw.mk_individual_email || null,
    knessetNum: raw.knesset_num,
  };
}
