'use client';

import Link from 'next/link';
import { Moon, Sun, User as UserIcon } from 'lucide-react';

import { useSession } from 'next-auth/react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import Logout from '@/components/common/logout';
import { cn } from '@/lib/utils';

/**
 * Header authentication slot. Shows a Login link when signed out,
 * or a small dropdown with the user's name and a Logout button.
 */
export function HeaderAccount() {
  const { data, status } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  if (status === 'loading') {
    return <div className="size-11" aria-hidden />;
  }

  if (!data?.user) {
    return (
      <Link
        href="/login"
        className="flex size-11 items-center justify-center rounded-md text-ink transition-colors hover:text-raven"
      >
        <UserIcon size={19} aria-hidden />
        <span className="sr-only">Sign in</span>
      </Link>
    );
  }

  const isAdmin = data.user.role === 'ADMIN';

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
        <DropdownMenuLabel className="truncate">{data.user.email}</DropdownMenuLabel>
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
