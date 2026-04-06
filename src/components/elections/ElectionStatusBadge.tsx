import { Badge } from '@/components/ui/badge';

interface ElectionStatusBadgeProps {
  status: string;
  labels: Record<string, string>;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  potential: 'outline',
  confirmed: 'default',
  withdrawn: 'secondary',
  disqualified: 'destructive',
  removed: 'destructive',
};

export default function ElectionStatusBadge({ status, labels }: ElectionStatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status] ?? 'outline'}>
      {labels[status] ?? status}
    </Badge>
  );
}
