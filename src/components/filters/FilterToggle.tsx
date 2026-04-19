'use client';

import { Button } from '@/components/ui/button';
import type { ToggleFilterField } from './types';

interface FilterToggleProps {
  field: ToggleFilterField;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  activeIcon?: React.ReactNode;
}

export default function FilterToggle({
  field,
  value,
  onChange,
  icon,
  activeIcon,
}: FilterToggleProps) {
  const onValue = field.onValue ?? 'true';
  const isActive = value === onValue;

  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={() => onChange(isActive ? '' : onValue)}
      className="h-9 gap-1.5 rounded-xl"
    >
      {isActive ? (activeIcon ?? icon) : icon}
      {field.label}
    </Button>
  );
}
