import { redirect } from 'next/navigation';

export default function AdminClustersRedirect() {
  redirect('/admin/ai-review/clusters');
}

