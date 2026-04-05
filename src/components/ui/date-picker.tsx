'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { he, enUS, ar, ru } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useLocale } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const dateFnsLocales: Record<string, typeof enUS> = {
  he,
  en: enUS,
  ar,
  ru,
};

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const locale = useLocale();
  const dateFnsLocale = dateFnsLocales[locale] ?? enUS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            data-empty={!value}
            className={cn(
              'h-9 w-auto min-w-35 justify-start text-start font-normal data-[empty=true]:text-muted-foreground',
              className,
            )}
          />
        }
      >
        <CalendarIcon />
        {value ? (
          format(value, 'PPP', { locale: dateFnsLocale })
        ) : (
          <span>{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date);
            setOpen(false);
          }}
          locale={dateFnsLocale}
        />
      </PopoverContent>
    </Popover>
  );
}
