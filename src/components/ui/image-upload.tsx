'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconX } from '@tabler/icons-react';

interface ImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  onFileChange?: (file: File | null) => void;
  label?: string;
  maxSize?: number; // MB
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  onFileChange,
  label = 'Image',
  maxSize = 5,
  disabled = false,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return reset();

    if (file.size > maxSize * 1024 * 1024) return setError(`Max ${maxSize}MB`);
    if (!file.type.startsWith('image/')) return setError('Invalid image');

    setError(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(url);
    onFileChange?.(file);
  };

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    onChange('');
    onFileChange?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-medium">{label}</Label>}

      <div
        className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer relative"
        onClick={() => !disabled && inputRef.current?.click()}
      >
        {preview ? (
          <>
            <div className="relative w-full h-full overflow-hidden rounded-lg">
              <Image src={preview} alt="Preview" fill className="object-cover" />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2 z-20 h-6 w-6 rounded-full p-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              disabled={disabled}
            >
              <IconX className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <p className="text-gray-400 text-xs text-center">Click to upload</p>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}
