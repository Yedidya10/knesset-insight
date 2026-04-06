import type {
  ODataVoteHeader,
  ODataMemberVote,
  OKnessetMember,
  ODataV4PlenumVoteResult,
} from './types';

/**
 * Map OData v4 PlenumVoteResult ResultCode to English enum value.
 * v4 codes: 7=for, 8=against, 9=abstain
 */
export function mapV4ResultCode(
  resultCode: number,
): 'for' | 'against' | 'abstain' | 'absent' {
  switch (resultCode) {
    case 7:
      return 'for';
    case 8:
      return 'against';
    case 9:
      return 'abstain';
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
export function transformVoteHeader(raw: ODataVoteHeader) {
  return {
    knessetId: raw.vote_id,
    title: raw.vote_item_dscr,
    voteDate: new Date(raw.vote_date),
    voteType: String(raw.vote_type),
    knessetNum: raw.knesset_num,
    sessionId: raw.session_id ? Number(raw.session_id) : null,
    sessItemId: raw.sess_item_id ?? null,
    forCount: raw.total_for,
    againstCount: raw.total_against,
    abstainCount: raw.total_abstain,
    isAccepted: raw.is_accepted === 1,
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
  return {
    knessetId: raw.mk_individual_id,
    firstName: raw.mk_individual_first_name,
    lastName: raw.mk_individual_name,
    isCurrent: raw.mk_individual_is_current,
    gender: raw.mk_individual_gender,
    birthDate: raw.mk_individual_date_of_birth || null,
    imageUrl: raw.mk_individual_photo || null,
    imageSource: raw.mk_individual_photo ? ('oknesset' as const) : null,
    imageAttribution: raw.mk_individual_photo
      ? 'כנסת פתוחה — הסדנא לידע ציבורי'
      : null,
    email: raw.mk_individual_email || null,
    knessetNum: raw.knesset_num,
  };
}
