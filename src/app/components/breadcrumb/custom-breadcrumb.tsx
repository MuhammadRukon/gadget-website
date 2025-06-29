import { uppercase } from '@/app/utils/helper';
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

export function CustomBreadcrumb({ items }: BreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <BreadcrumbItem>
              {index === items.length - 1 ? (
                <BreadcrumbPage>{uppercase(item.label as string)}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={item.href ?? '#'}>
                  {uppercase(item.label as string)}
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
