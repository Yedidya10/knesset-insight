import { cookies } from 'next/headers';

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token')?.value;
  const secret = process.env.ADMIN_SECRET;
  return !!secret && !!adminToken && adminToken === secret;
}
