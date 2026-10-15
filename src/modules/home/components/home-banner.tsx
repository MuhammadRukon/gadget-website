import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import type { HomeBanner as HomeBannerContent } from '../home-content';

/**
 * Opening banner: statement and actions first, then the banner image at full
 * container width. The image eases out of a slight zoom as the page scrolls
 * (driven by HomeMotion through data attributes; static without JS).
 */
export function HomeBanner({ banner }: Readonly<{ banner: HomeBannerContent }>) {
  return (
    <section aria-labelledby="home-banner" className="pt-8 md:pt-14">
      <div className="mx-auto max-w-4xl text-center">
        <h1
          id="home-banner"
          data-banner-title
          className="font-display text-[clamp(2.4rem,7vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.03em] font-stretch-expanded text-balance"
        >
          {banner.title}
        </h1>
        <p
          data-banner-sub
          className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-2 md:text-base"
        >
          {banner.subtitle}
        </p>
        <div data-banner-sub className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={banner.primary.href}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-raven px-6 text-[15px] font-medium text-on-raven transition-colors hover:bg-raven-ink"
          >
            {banner.primary.label}
          </Link>
          {banner.secondary ? (
            <Link
              href={banner.secondary.href}
              className="group inline-flex h-12 items-center gap-1.5 px-3 text-[15px] font-medium text-raven-ink"
            >
              {banner.secondary.label}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          ) : null}
        </div>
      </div>

      <div
        data-banner-frame
        className="relative mt-10 aspect-[4/3] overflow-hidden rounded-2xl bg-field sm:aspect-[16/9] md:mt-14 lg:aspect-[2/1]"
      >
        <div data-banner-image className="absolute inset-0 will-change-transform">
          <Image
            src={banner.image}
            alt={banner.alt}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1180px"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
