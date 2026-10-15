import Image from 'next/image';
import Link from 'next/link';
import { JSX } from 'react';

export function HeaderLogo(): JSX.Element {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 rounded-sm"
      aria-label="Cryptech home"
    >
      <Image
        src="/logo.png"
        alt=""
        width={32}
        height={32}
        className="size-8 object-contain"
        priority
      />
      <span className="font-display text-[17px] font-bold uppercase leading-none tracking-[0.02em] font-stretch-expanded max-[359px]:hidden">
        Cryptech
      </span>
    </Link>
  );
}
