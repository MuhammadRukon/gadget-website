'use client';

import * as React from 'react';
import {
  IconBrandBooking,
  IconBrandProducthunt,
  IconCategory,
  IconDashboard,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';

import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Logo } from '@/app/common/logo/logo.atom';

const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: IconDashboard,
    },
    {
      title: 'Categories',
      url: '/dashboard/categories',
      icon: IconCategory,
    },
    {
      title: 'Brands',
      url: '/dashboard/brands',
      icon: IconBrandBooking,
    },
    { title: 'Products', url: '/dashboard/products', icon: IconBrandProducthunt },
    { title: 'Users', url: '/dashboard/users', icon: IconUsers },
  ],
  navSecondary: [
    {
      title: 'Settings',
      url: '/dashboard/settings',
      icon: IconSettings,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <AppSidebar.Header />
      <AppSidebar.Content data={data} />
      <AppSidebar.Footer data={data} />
    </Sidebar>
  );
}

AppSidebar.Header = function AppSidebarHeader({ src }: { src?: string }) {
  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
            <Logo alt="logo" className="w-full h-12 object-contain" src={src} />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
};
//TODO: remove any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
AppSidebar.Content = function AppSidebarContent({ data }: { data: any }) {
  return (
    <SidebarContent>
      <NavMain items={data.navMain} />

      <NavSecondary items={data.navSecondary} className="mt-auto" />
    </SidebarContent>
  );
};
//TODO: remove any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
AppSidebar.Footer = function AppSidebarFooter({ data }: { data: any }) {
  return (
    <SidebarFooter>
      <NavUser user={data.user} />
    </SidebarFooter>
  );
};
