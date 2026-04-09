'use client';

import { type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { useAdminEdit } from './AdminEditProvider';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Props {
  children: ReactNode;
  editForm: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export default function InlineEditWrapper({ children, editForm, side = 'bottom' }: Props) {
  const { isAdmin } = useAdminEdit();

  if (!isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="group/admin relative inline-flex items-center gap-1">
      {children}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 transition-opacity group-hover/admin:opacity-100"
              aria-label="Edit"
            />
          }
        >
          <Pencil className="h-3 w-3" />
        </PopoverTrigger>
        <PopoverContent side={side} className="w-80">
          {editForm}
        </PopoverContent>
      </Popover>
    </div>
  );
}
