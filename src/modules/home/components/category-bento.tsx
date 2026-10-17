import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { HomeTile } from '../home-content';

const TONE: Record<HomeTile['tone'], string> = {
  ink: 'bg-ink text-paper',
  field: 'bg-field text-ink',
  raven: 'bg-raven text-on-raven',
};

// Bento placement for up to five tiles: one large lead, one wide, two small, one wide.
const PLACE = ['col-span-2 md:row-span-2', 'col-span-2', 'col-span-1', 'col-span-1', 'col-span-2'];

/** Apple-style bento of shopping routes. Tiles without a drawing are set as oversized type. */
export function CategoryBento({ tiles }: Readonly<{ tiles: HomeTile[] }>) {
  if (tiles.length === 0) return null;
  return (
    <section aria-labelledby="bento" data-offscreen className="mt-20 md:mt-28">
      <h2
        id="bento"
        data-reveal
        className="mb-8 max-w-2xl font-display text-[clamp(2rem,4.6vw,3.5rem)] font-bold leading-[0.95] tracking-[-0.03em] font-stretch-expanded"
      >
        Where do you want to start?
      </h2>
      <ul
        data-reveal-group
        className="grid auto-rows-[180px] grid-cols-2 gap-3 md:auto-rows-[240px] md:grid-cols-4 md:gap-4"
      >
        {tiles.slice(0, 5).map((tile, i) => (
          <li key={tile.title} data-reveal-item className={PLACE[i]}>
            <Link
              href={tile.href}
              className={cn(
                'group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-5 transition-transform duration-500 ease-out hover:-translate-y-1 md:p-6',
                TONE[tile.tone],
              )}
            >
              <div className="relative z-10 flex items-start justify-between gap-3">
                <p className="max-w-[18ch] text-sm opacity-80">{tile.blurb}</p>
                <ArrowUpRight
                  aria-hidden
                  className="size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </div>

              {tile.drawing ? (
                <div
                  aria-hidden
                  className="absolute -bottom-[10%] -right-[8%] aspect-square w-[58%] max-md:-top-[4%] max-md:bottom-auto max-md:w-[46%] max-md:opacity-35 transition-transform duration-700 ease-out group-hover:-rotate-6 group-hover:scale-105"
                >
                  <Image
                    src={tile.drawing}
                    alt=""
                    fill
                    sizes="240px"
                    className={cn('object-contain', tile.tone !== 'field' && 'invert')}
                  />
                </div>
              ) : null}

              <p
                className={cn(
                  'relative z-10 font-display font-bold uppercase leading-[0.85] tracking-[-0.03em] font-stretch-expanded',
                  i === 0
                    ? 'text-[clamp(2.4rem,7.5vw,6.5rem)]'
                    : 'text-[clamp(1.05rem,3.2vw,2.5rem)]',
                )}
              >
                {tile.title}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
