import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import React from 'react';
import { FieldValues } from 'react-hook-form';

interface SelectAtomProps {
  placeholder?: string;
  field: FieldValues;
  options: { value: string; label: string }[];
}

export default function SelectAtom({ field, options, placeholder = '' }: SelectAtomProps) {
  return (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
