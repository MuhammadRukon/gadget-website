'use client';

import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import { ProductImage } from './product-image';

interface ProductDetailGalleryProps {
  productName: string;
  brand: string;
  images: { url: string; alt: string | null }[];
}

export function ProductDetailGallery({ productName, brand, images }: ProductDetailGalleryProps) {
  const [activeImage, setActiveImage] = useState(0);
  const current = images[activeImage];

  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse">
      <ProductImage
        src={current?.url ?? null}
        alt={current?.alt ?? productName}
        brand={brand}
        sizes="(max-width: 1024px) 100vw, 55vw"
        priority
        className="aspect-[4/3] flex-1 rounded-lg sm:aspect-square"
      />
      {images.length > 1 ? (
        <ul
          aria-label="Product photos"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:w-16 md:flex-col md:overflow-visible md:px-0"
        >
          {images.map((img, idx) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveImage(idx)}
                aria-label={`Show photo ${idx + 1} of ${images.length}`}
                aria-current={activeImage === idx}
                className={cn(
                  'relative block size-16 overflow-hidden rounded-md bg-field ring-offset-2 ring-offset-paper transition-shadow',
                  activeImage === idx
                    ? 'ring-2 ring-solder'
                    : 'hover:ring-1 hover:ring-rule-strong',
                )}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1.5 mix-blend-multiply dark:mix-blend-normal"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
