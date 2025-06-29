import React from 'react';
import { CustomBreadcrumb } from '../breadcrumb/custom-breadcrumb';

export default function SearchPage({ category, brand }: { category: string; brand?: string }) {
  const breadcrumbItems = [{ label: 'Home', href: '/' }];
  if (category) {
    breadcrumbItems.push({ label: category, href: `/${category}` });
  }
  if (brand) {
    breadcrumbItems.push({ label: brand, href: `/${category}/${brand}` });
  }
  return (
    <div className="border border-gray-200 w-full h-96">
      <CustomBreadcrumb items={breadcrumbItems} />
    </div>
  );
}
