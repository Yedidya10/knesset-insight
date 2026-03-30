import type {
  ODataVoteHeader,
  ODataMemberVote,
  OKnessetMember,
} from './types';

/**
 * Map Hebrew vote result to English enum value.
 */
export function mapVoteValue(
  hebrewResult: string,
): 'for' | 'against' | 'abstain' | 'absent' {
  switch (hebrewResult) {
    case 'בעד':
      return 'for';
    case 'נגד':
      return 'against';
    case 'נמנע':
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
    voteDate: new Date(raw.vote_date_str),
    voteType: raw.vote_type,
    knessetNum: raw.knesset_num,
    sessionId: raw.session_id,
    forCount: raw.totalfor,
    againstCount: raw.totalagainst,
    abstainCount: raw.totalabstain,
    isAccepted: raw.vote_result === 'אושר',
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
    email: raw.mk_individual_email || null,
    knessetNum: raw.knesset_num,
  };
}
