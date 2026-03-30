export interface Context {
  // Will be extended with auth user when Supabase auth is added
}

export function createContext(): Context {
  return {};
}
