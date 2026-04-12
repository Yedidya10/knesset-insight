import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth/admin';
import AdminSidebar from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authorized = await isAdmin();

  if (!authorized) {
    redirect('/admin/login');
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
