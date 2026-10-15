import Image from 'next/image';
import Link from 'next/link';
import { JSX } from 'react';

/**
 * Raven mark plus the live-text wordmark (RAVYN in ink, TECH in blue-gray).
 * Light mode uses the colour-inverted mark so the silhouette holds on paper;
 * dark mode uses the original. When the header is compact the wordmark folds
 * away and the mark stays.
 */
export function HeaderLogo(): JSX.Element {
  return (
    <Link
      href="/"
      className="group flex shrink-0 items-center rounded-sm"
      aria-label="Ravyntech home"
    >
      <Image
        src="/brand/ravyntech-mark-inverted.png"
        alt=""
        width={48}
        height={32}
        className="h-8 w-auto object-contain transition-transform duration-500 ease-out group-hover:-rotate-6 dark:hidden"
        priority
      />
      <Image
        src="/brand/ravyntech-mark.png"
        alt=""
        width={48}
        height={32}
        className="hidden h-8 w-auto object-contain transition-transform duration-500 ease-out group-hover:-rotate-6 dark:block"
      />
      <span className="ml-2 max-w-40 overflow-hidden whitespace-nowrap font-display text-[17px] font-bold uppercase leading-none tracking-[0.02em] font-stretch-expanded transition-[max-width,opacity,margin] duration-300 ease-out max-[419px]:hidden group-data-[compact=true]/h:ml-0 group-data-[compact=true]/h:max-w-0 group-data-[compact=true]/h:opacity-0">
        Ravyn<span className="text-raven">tech</span>
      </span>
    </Link>
  );
}
