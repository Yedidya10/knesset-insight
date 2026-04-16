/**
 * Policy domains — used for filtering policy_stances.domain
 * Stored as a code constant, not a DB table.
 */
export const POLICY_DOMAINS = {
  national_security: {
    he: 'ביטחון לאומי וצבא',
    en: 'National Security & Military',
    ar: 'الأمن القومي والجيش',
    ru: 'Национальная безопасность и армия',
  },
  foreign_policy: {
    he: 'מדיניות חוץ',
    en: 'Foreign Policy',
    ar: 'السياسة الخارجية',
    ru: 'Внешняя политика',
  },
  criminal_justice: {
    he: 'משפט פלילי ואכיפה',
    en: 'Criminal Justice',
    ar: 'العدالة الجنائية',
    ru: 'Уголовное правосудие',
  },
  civil_rights: {
    he: 'זכויות אדם וחירויות',
    en: 'Human & Civil Rights',
    ar: 'حقوق الإنسان والحريات',
    ru: 'Права человека и свободы',
  },
  economy: {
    he: 'כלכלה ומסחר',
    en: 'Economy & Trade',
    ar: 'الاقتصاد والتجارة',
    ru: 'Экономика и торговля',
  },
  taxation: {
    he: 'מיסוי ותקציב',
    en: 'Taxation & Budget',
    ar: 'الضرائب والميزانية',
    ru: 'Налоги и бюджет',
  },
  healthcare: {
    he: 'בריאות',
    en: 'Healthcare',
    ar: 'الصحة',
    ru: 'Здравоохранение',
  },
  education: {
    he: 'חינוך',
    en: 'Education',
    ar: 'التعليم',
    ru: 'Образование',
  },
  welfare: {
    he: 'רווחה וביטוח לאומי',
    en: 'Welfare & Social Security',
    ar: 'الرفاه والتأمين الوطني',
    ru: 'Социальное обеспечение',
  },
  labor: {
    he: 'עבודה ותעסוקה',
    en: 'Labor & Employment',
    ar: 'العمل والتوظيف',
    ru: 'Труд и занятость',
  },
  housing: {
    he: 'דיור ונדל"ן',
    en: 'Housing & Real Estate',
    ar: 'الإسكان والعقارات',
    ru: 'Жилье и недвижимость',
  },
  infrastructure: {
    he: 'תשתיות ותחבורה',
    en: 'Infrastructure & Transport',
    ar: 'البنية التحتية والنقل',
    ru: 'Инфраструктура и транспорт',
  },
  environment: {
    he: 'איכות סביבה',
    en: 'Environment & Climate',
    ar: 'البيئة والمناخ',
    ru: 'Экология и климат',
  },
  agriculture: {
    he: 'חקלאות ומזון',
    en: 'Agriculture & Food',
    ar: 'الزراعة والغذاء',
    ru: 'Сельское хозяйство и продовольствие',
  },
  energy: {
    he: 'אנרגיה ומים',
    en: 'Energy & Water',
    ar: 'الطاقة والمياه',
    ru: 'Энергетика и водоснабжение',
  },
  technology: {
    he: 'טכנולוגיה ותקשורת',
    en: 'Technology & Communications',
    ar: 'التكنولوجيا والاتصالات',
    ru: 'Технологии и коммуникации',
  },
  local_gov: {
    he: 'שלטון מקומי',
    en: 'Local Government',
    ar: 'الحكم المحلي',
    ru: 'Местное самоуправление',
  },
  civil_law: {
    he: 'משפט אזרחי',
    en: 'Civil & Commercial Law',
    ar: 'القانون المدني والتجاري',
    ru: 'Гражданское и коммерческое право',
  },
  religion: {
    he: 'דת ומדינה',
    en: 'Religion & State',
    ar: 'الدين والدولة',
    ru: 'Религия и государство',
  },
  minorities: {
    he: 'מיעוטים ושוויון',
    en: 'Minorities & Equality',
    ar: 'الأقليات والمساواة',
    ru: 'Меньшинства и равенство',
  },
  immigration: {
    he: 'עלייה וקליטה',
    en: 'Immigration & Absorption',
    ar: 'الهجرة والاستيعاب',
    ru: 'Репатриация и абсорбция',
  },
  culture: {
    he: 'תרבות וספורט',
    en: 'Culture & Sport',
    ar: 'الثقافة والرياضة',
    ru: 'Культура и спорт',
  },
  planning: {
    he: 'תכנון ובנייה',
    en: 'Planning & Construction',
    ar: 'التخطيط والبناء',
    ru: 'Планирование и строительство',
  },
  governance: {
    he: 'ממשל ומנהל ציבורי',
    en: 'Governance & Public Admin',
    ar: 'الحوكمة والإدارة العامة',
    ru: 'Управление и госадминистрация',
  },
  parliamentary: {
    he: 'פיקוח פרלמנטרי',
    en: 'Parliamentary Oversight',
    ar: 'الرقابة البرلمانية',
    ru: 'Парламентский контроль',
  },
} as const;

export type PolicyDomain = keyof typeof POLICY_DOMAINS;

export const POLICY_DOMAIN_LIST = Object.keys(POLICY_DOMAINS) as PolicyDomain[];
