'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { trpc } from '@/lib/trpc';
import { useAdminEdit } from '@/components/admin/AdminEditProvider';

interface Props {
  entityType: string;
  entityId: string;
}

export default function EntityActivityPopover({ entityType, entityId }: Props) {
  const t = useTranslations('admin.entityActivity');
  const { isAdmin } = useAdminEdit();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    {
      id: number;
      action: string;
      details: unknown;
      createdAt: string | Date | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open || !isAdmin) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await trpc.admin.entityActivity.query({
          entityType,
          entityId,
          limit: expanded ? 20 : 4,
        });
        if (!cancelled) setItems(res as typeof items);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [open, entityType, entityId, expanded, isAdmin]);

  if (!isAdmin) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.preventDefault()}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80"
        onClick={(e) => e.preventDefault()}
      >
        <h4 className="mb-2 text-sm font-medium">{t('title')}</h4>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-2 text-xs">
            {t('noActivity')}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const details = item.details as
                | Record<string, unknown>
                | null
                | undefined;
              return (
                <div
                  key={item.id}
                  className="space-y-1 rounded-md border p-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {item.action}
                    </Badge>
                    <span className="text-muted-foreground">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString()
                        : '—'}
                    </span>
                  </div>
                  {details?.reason ? (
                    <p className="text-muted-foreground">
                      {String(details.reason)}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {!expanded && items.length >= 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1 text-xs"
                onClick={() => setExpanded(true)}
              >
                <ChevronDown className="h-3 w-3" />
                {t('showMore')}
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
