'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SelectFilterField } from './types';

interface FilterSelectProps {
  field: SelectFilterField;
  value: string;
  onChange: (value: string) => void;
}

export default function FilterSelect({
  field,
  value,
  onChange,
}: FilterSelectProps) {
  const allValue = field.allValue ?? '_all';
  const allLabel = field.options.find((o) => o.value === allValue)?.label;

  const items: Record<string, string> = {};
  if (allLabel) {
    items[allValue] = allLabel;
  }
  for (const opt of field.options) {
    if (opt.value !== allValue) {
      items[opt.value] = opt.label;
    }
  }

  return (
    <Select
      value={value || allValue}
      onValueChange={(val) => onChange(val === allValue ? '' : (val ?? ''))}
      items={items}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {field.options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
