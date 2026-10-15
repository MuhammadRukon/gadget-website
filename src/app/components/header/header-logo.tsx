import Image from 'next/image';
import Link from 'next/link';
import { JSX } from 'react';

/** Raven mark plus the live-text wordmark: RAVYN in ink, TECH in the brand blue-gray. */
export function HeaderLogo(): JSX.Element {
  return (
    <Link
      href="/"
      className="group flex shrink-0 items-center gap-2 rounded-sm"
      aria-label="Ravyntech home"
    >
      <Image
        src="/brand/ravyntech-mark.png"
        alt=""
        width={48}
        height={32}
        className="h-8 w-auto object-contain transition-transform duration-500 ease-out group-hover:-rotate-6"
        priority
      />
      <span className="font-display text-[17px] font-bold uppercase leading-none tracking-[0.02em] font-stretch-expanded max-[359px]:hidden">
        Ravyn<span className="text-raven">tech</span>
      </span>
    </Link>
  );
}
