'use client';

import Link from 'next/link';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { logoutAction } from '@/modules/auth/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Header authentication slot. Shows a Login link when signed out,
 * or a small dropdown with the user's name and a Logout button.
 */
export function HeaderAccount() {
  const { data, status } = useSession();

  if (status === 'loading') {
    return <div className="h-6 w-20 animate-pulse rounded bg-muted" aria-hidden />;
  }

  if (!data?.user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 px-3 h-full transition-all duration-200 hover:bg-gray-100 dark:hover:bg-accent"
      >
        <UserIcon size={14} />
        <span className="text-sm font-medium text-foreground text-nowrap">Login</span>
      </Link>
    );
  }

  const name = data.user.name ?? data.user.email ?? 'Account';
  const isAdmin = data.user.role === 'ADMIN';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 h-full transition-all duration-200 hover:bg-gray-100 dark:hover:bg-accent outline-none">
        <UserIcon size={14} />
        <span className="text-sm font-medium text-foreground text-nowrap max-w-32 truncate">
          {name}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/dashboard">Admin dashboard</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <button type="submit" className="w-full">
            <DropdownMenuItem asChild>
              <span className="flex w-full items-center gap-2">
                <LogOut size={14} />
                Log out
              </span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
