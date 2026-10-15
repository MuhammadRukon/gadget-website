import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

import React from 'react';

export interface BreadcrumbItem {
  label: string | undefined;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * schema.org BreadcrumbList JSON-LD for the same trail rendered by
 * CustomBreadcrumb. `baseUrl` is the site origin (no trailing slash);
 * entries without `href` (typically the current page) are omitted from
 * `item`, matching Google's guidance that the last crumb's URL is optional.
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[], baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${baseUrl}${item.href}` } : {}),
    })),
  };
}

export function CustomBreadcrumb({ items }: Readonly<BreadcrumbProps>) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[13px] text-ink-2">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <BreadcrumbItem>
              {index === items.length - 1 ? (
                <BreadcrumbPage className="text-ink">{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={item.href ?? '#'} className="hover:text-raven-ink">
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < items.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
