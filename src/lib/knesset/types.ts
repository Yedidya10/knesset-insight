/**
 * Raw OData types from Knesset APIs.
 * Field names match the OData entity property names.
 */

// ParliamentInfo.svc — KNS_Person (used for members)
export interface ODataPerson {
  PersonID: number;
  LastName: string;
  FirstName: string;
  GenderDesc: string | null;
  Email: string | null;
  IsCurrent: boolean;
  LastUpdatedDate: string;
}

// Open Knesset — mk_individual CSV
export interface OKnessetMember {
  mk_individual_id: number;
  mk_individual_first_name: string;
  mk_individual_name: string; // last name
  mk_individual_first_name_eng: string;
  mk_individual_name_eng: string;
  mk_individual_email: string;
  mk_individual_photo: string;
  mk_individual_gender: string;
  mk_individual_is_current: boolean;
  mk_individual_date_of_birth: string;
  faction_id: number;
  faction_name: string;
  knesset_num: number;
}

// Votes.svc — View_vote_rslts_hdr_Approved
export interface ODataVoteHeader {
  vote_id: number;
  vote_date_str: string;
  vote_time_str: string;
  vote_item_dscr: string;
  sess_item_nbr: number;
  sess_item_id: number;
  totalfor: number;
  totalagainst: number;
  totalabstain: number;
  vote_result: string;
  vote_type: string;
  is_elctrnc_vote: boolean;
  knesset_num: number;
  session_id: number;
  LastUpdatedDate?: string;
}

// Votes.svc — vote_rslts_kmmbr_shadow
export interface ODataMemberVote {
  vote_id: number;
  kmmbr_id: number;
  kmmbr_name: string;
  vote_result: string; // 'בעד', 'נגד', 'נמנע', 'לא הצביע'
}

// ParliamentInfo.svc — KNS_Bill
export interface ODataBill {
  BillID: number;
  Name: string;
  SubTypeDesc: string;
  StatusID: number;
  StatusDesc?: string;
  KnessetNum: number;
  PrivateNumber: number;
  PublicationDate: string | null;
  LastUpdatedDate: string;
}

// Open Knesset CSV — parties/factions
export interface OKnessetFaction {
  faction_id: number;
  faction_name: string;
  knesset_num: number;
  is_coalition: boolean;
  seats: number;
}
