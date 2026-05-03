'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/sonner';
import { makeQueryClient } from '@/lib/queryClient';
import { useGuestCartMerge } from '@/modules/cart/hooks';

/**
 * Mounts the one-time effect that merges any persisted guest cart
 * into the server cart immediately after sign-in. Lives here so no
 * individual cart consumer (page, panel, header) has to remember to
 * mount it themselves.
 */
function CartBootstrap(): null {
  useGuestCartMerge();
  return null;
}

/**
 * Root client providers. Mounted once in the app root layout so that
 * session, theme, query cache, and toaster are shared across every
 * route group (storefront, admin, auth).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false} refetchInterval={0}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <CartBootstrap />
          {children}
          <Toaster duration={2000} />
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
