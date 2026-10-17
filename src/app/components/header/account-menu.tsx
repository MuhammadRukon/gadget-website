'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Moon, Sun, User as UserIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Logout from '@/components/common/logout';
import { cn } from '@/lib/utils';

/** Signed-in account dropdown; loaded only once a session exists. */
export function AccountMenu({ email, isAdmin }: Readonly<{ email: string; isAdmin: boolean }>) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          'flex size-11 cursor-pointer items-center justify-center rounded-md text-ink transition-colors hover:text-raven',
        )}
      >
        <UserIcon size={19} aria-hidden />
        <span className="sr-only">Account</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="sf w-60 rounded-md">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/orders">My orders</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/addresses">Saved addresses</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/reviews">Write a review</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/settings">Change password</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <button
            type="button"
            className="w-full"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            Switch to {isDark ? 'light' : 'dark'} mode{' '}
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/dashboard">Admin dashboard</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <Logout />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
