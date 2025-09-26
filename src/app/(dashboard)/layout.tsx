'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();

  return (
    <main>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider
          style={
            {
              '--sidebar-width': 'calc(var(--spacing) * 72)',
              '--header-height': 'calc(var(--spacing) * 12)',
            } as React.CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset>
            <SiteHeader />
            <div className="p-4 md:p-6 flex-1">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </QueryClientProvider>
    </main>
  );
}
