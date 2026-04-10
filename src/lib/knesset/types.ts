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
  vote_date: string;
  vote_time: string;
  vote_item_dscr: string;
  sess_item_dscr?: string;
  sess_item_nbr: number;
  sess_item_id: number;
  total_for: number;
  total_against: number;
  total_abstain: number;
  is_accepted: number;
  vote_type: number;
  is_elctrnc_vote: number;
  knesset_num: number;
  session_id: string;
  session_num: number;
}

// Votes.svc — vote_rslts_kmmbr_shadow
export interface ODataMemberVote {
  vote_id: number;
  kmmbr_id: string; // zero-padded string e.g. "000000405"
  kmmbr_name: string;
  vote_result: number; // 1=for, 2=against, 3=abstain
  knesset_num: number;
  faction_id: number;
  faction_name: string;
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
}

// OData v4 — KNS_PlenumVote (ParliamentInfo)
export interface ODataV4PlenumVote {
  Id: number;
  VoteDateTime: string;
  SessionID: number | null;
  ItemID: number | null;
  Ordinal: number | null;
  VoteMethodID: number | null;
  VoteMethodDesc: string | null;
  VoteStatusCode: number | null;
  VoteStatusDesc: string | null;
  VoteTitle: string;
  VoteSubject: string | null;
  IsNoConfidenceInGov: boolean | null;
  LastUpdatedDate: string | null;
  ForOptionID: number | null;
  ForOptionDesc: string | null;
  AgainstOptionID: number | null;
  AgainstOptionDesc: string | null;
  KNS_PlenumSession?: { KnessetNum: number };
}

// OData v4 — KNS_PlenumVoteResult (ParliamentInfo)
export interface ODataV4PlenumVoteResult {
  Id: number;
  MkId: number;
  VoteID: number;
  VoteDate: string;
  ResultCode: number; // 7=for, 8=against, 9=abstain
  ResultDesc: string;
  LastUpdatedDate: string | null;
  LastName: string;
  FirstName: string;
  SessionID: number | null;
  ItemID: number | null;
}

// OData v4 — KNS_DocumentBill (ParliamentInfo)
export interface ODataV4DocumentBill {
  Id: number;
  BillID: number;
  GroupTypeID: number;
  GroupTypeDesc: string;
  ApplicationDesc: string;
  FilePath: string;
  LastUpdatedDate: string | null;
}
