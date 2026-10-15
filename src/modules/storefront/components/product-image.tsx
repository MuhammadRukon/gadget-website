import Image from 'next/image';

import { cn } from '@/lib/utils';

interface ProductImageProps {
  src: string | null;
  alt: string;
  /** Shown in the no-photo state so the tile still says what the product is. */
  brand: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/**
 * Product photo on the tinted field. Without a photo it renders an honest
 * "photo coming" plate (brand set wide) instead of reusing the store logo,
 * which read as the product itself.
 */
export function ProductImage({
  src,
  alt,
  brand,
  sizes,
  priority,
  className,
}: Readonly<ProductImageProps>) {
  return (
    <div className={cn('relative overflow-hidden bg-field', className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-contain p-[8%] mix-blend-multiply dark:mix-blend-normal"
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col justify-between p-[9%]"
          role="img"
          aria-label={`${alt}, photo coming soon`}
        >
          <span className="font-display text-[clamp(1.1rem,4vw,1.6rem)] font-semibold uppercase leading-none tracking-[-0.01em] text-ink/15 font-stretch-expanded">
            {brand}
          </span>
          <span className="text-[11px] text-ink-2">Photo coming soon</span>
        </div>
      )}
    </div>
  );
}
