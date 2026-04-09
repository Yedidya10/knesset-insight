import { cookies } from 'next/headers';

export interface Context {
  isAdmin: boolean;
}

export async function createContext(): Promise<Context> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token')?.value;
  const secret = process.env.ADMIN_SECRET;
  const isAdmin = !!secret && !!adminToken && adminToken === secret;
  return { isAdmin };
}
