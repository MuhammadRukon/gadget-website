'use client';

import React, { useState } from 'react';
import { CustomBreadcrumb } from '../breadcrumb/custom-breadcrumb';
import { SectionContainer } from '../container/section-container';

import { RANGE_MAX, RANGE_MIN, RANGE_STEP } from '@/app/constants';
import { Range } from '../range/range';
import { FilterLayout } from '../layout/filter-layout';
import { CustomCheckbox } from '@/app/common/custom-checkbox/custom-checkbox';
import { Availability } from '@/app/enums';
import { removeOccur, uppercase } from '@/app/utils/helper';

export default function SearchPage({ category, brand }: { category: string; brand?: string }) {
  const breadcrumbItems = [{ label: 'Home', href: '/' }];
  if (category) {
    breadcrumbItems.push({ label: category, href: `/${category}` });
  }
  if (brand) {
    breadcrumbItems.push({ label: brand, href: `/${category}/${brand}` });
  }

  const [priceRange, setPriceRange] = useState([RANGE_MIN, RANGE_MAX]);

  const [availability, setAvailability] = useState<string[]>([]);

  const availabilityOptions = [
    { id: Availability.IN_STOCK, label: Availability.IN_STOCK },
    { id: Availability.UPCOMING, label: Availability.UPCOMING },
    { id: Availability.PRE_ORDER, label: Availability.PRE_ORDER },
  ];

  return (
    <>
      <CustomBreadcrumb items={breadcrumbItems} />
      <SectionContainer>
        <div className="grid grid-cols-[auto_1fr] grid-rows-[auto_1fr] gap-2 sm:gap-3  w-full">
          <aside className="row-span-2 w-[240px] space-y-3">
            <Range
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              max={RANGE_MAX}
              min={RANGE_MIN}
              step={RANGE_STEP}
            />
            <FilterLayout title="Availability">
              {availabilityOptions.map(({ id, label }) => (
                <CustomCheckbox
                  key={id}
                  id={id}
                  label={uppercase(removeOccur(label, '-', ' '), true)}
                  checked={availability.includes(id)}
                  onChange={() =>
                    setAvailability((prev) =>
                      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
                    )
                  }
                />
              ))}
            </FilterLayout>
          </aside>

          <div className="bg-gray-100 dark:bg-[#222223] p-3">filter</div>

          <main className="bg-gray-100 dark:bg-[#222223] p-3 overflow-auto">Products</main>
        </div>
      </SectionContainer>
    </>
  );
}
