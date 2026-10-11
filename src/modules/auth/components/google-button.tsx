'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

interface GoogleButtonProps {
  callbackUrl?: string;
  disabled?: boolean;
  label?: string;
}

export function GoogleButton({
  callbackUrl = '/',
  disabled,
  label = 'Continue with Google',
}: GoogleButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={disabled}
      onClick={() => signIn('google', { callbackUrl })}
    >
      {label}
    </Button>
  );
}
