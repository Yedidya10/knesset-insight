/**
 * Mapping of Knesset OData StatusID → Hebrew description for bills (TypeID=2).
 * Source: KNS_Status table from the Knesset OData API.
 */
export const BILL_STATUS_MAP: Record<string, string> = {
  '101': 'הכנה לקריאה ראשונה',
  '104': 'הונחה על שולחן הכנסת לדיון מוקדם',
  '106': 'בוועדת הכנסת לקביעת הוועדה המטפלת',
  '108': 'הכנה לקריאה ראשונה',
  '109': 'אושרה בוועדה לקריאה ראשונה',
  '110': 'הבקשה לדין רציפות נדחתה במליאה',
  '111': 'לדיון במליאה לקראת הקריאה הראשונה',
  '113': 'הכנה לקריאה שנייה ושלישית',
  '114': 'לדיון במליאה לקראת קריאה שנייה-שלישית',
  '115': 'הוחזרה לוועדה להכנה לקריאה שלישית',
  '117': 'לדיון במליאה לקראת קריאה שלישית',
  '118': 'התקבלה בקריאה שלישית',
  '120': 'לדיון במליאה על החלת דין רציפות',
  '122': 'מוזגה עם הצעת חוק אחרת',
  '124': 'הוסבה להצעה לסדר היום',
  '126': 'לאישור מיזוג בוועדת הכנסת',
  '130': 'הונחה על שולחן הכנסת לקריאה שנייה-שלישית',
  '131': 'הונחה על שולחן הכנסת לקריאה שלישית',
  '140': 'להסרה מסדר היום לבקשת ועדה',
  '141': 'הונחה על שולחן הכנסת לקריאה ראשונה',
  '142': 'בוועדת הכנסת לקביעת הוועדה המטפלת',
  '143': 'להסרה מסדר היום לבקשת ועדה',
  '150': 'במליאה לדיון מוקדם',
  '158': 'לאישור פיצול במליאה',
  '161': 'לאישור פיצול במליאה',
  '162': 'לאישור פיצול במליאה',
  '165': 'לאישור פיצול במליאה',
  '167': 'אושרה בוועדה לקריאה ראשונה',
  '169': 'לאישור מיזוג בוועדת הכנסת',
  '175': 'בדיון בוועדה על החלת דין רציפות',
  '176': 'הבקשה לדין רציפות נדחתה בוועדה',
  '177': 'נעצרה',
  '178': 'אושרה בוועדה לקריאה שנייה-שלישית',
  '179': 'אושרה בוועדה לקריאה שנייה-שלישית',
  '181': 'הודעה על בקשה להחלת דין רציפות',
};

/**
 * Get readable status text for a bill StatusID.
 * Returns the Hebrew description or the raw ID if unmapped.
 */
export function getBillStatusText(statusId: string | null | undefined): string {
  if (!statusId) return '';
  return BILL_STATUS_MAP[statusId] ?? statusId;
}

/**
 * Build the official Knesset website URL for a bill.
 */
export function getKnessetBillUrl(knessetId: number): string {
  return `https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=lawsuggestionssearch&lawitemid=${knessetId}`;
}
