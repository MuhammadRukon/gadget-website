'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { User as UserIcon } from 'lucide-react';

import { useSession } from 'next-auth/react';

const AccountMenu = dynamic(() => import('./account-menu').then((m) => m.AccountMenu), {
  ssr: false,
  loading: () => <div className="size-11" aria-hidden />,
});

/**
 * Header authentication slot. Shows a Login link when signed out,
 * or a small dropdown with the user's name and a Logout button.
 */
export function HeaderAccount() {
  const { data, status } = useSession();
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

  return <AccountMenu email={data.user.email ?? ''} isAdmin={data.user.role === 'ADMIN'} />;
}
