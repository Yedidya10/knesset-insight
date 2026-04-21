/**
 * Knesset terms with meaningful data in the platform.
 * Used by filter UIs (votes, legislation, members) to build Knesset dropdowns.
 * Order: newest first (default sort direction in the UI).
 */
export const SUPPORTED_KNESSETS = [25, 24, 23, 22, 21, 20] as const;

export type SupportedKnesset = (typeof SUPPORTED_KNESSETS)[number];
