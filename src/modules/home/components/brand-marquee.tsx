import Link from 'next/link';

interface Brand {
  id: string;
  name: string;
  slug: string;
}

/**
 * Brands the catalog carries, running as a slow ticker. Pauses on hover and
 * stands still under reduced motion. The second copy exists only for the
 * seamless loop and is hidden from assistive tech and the tab order.
 */
export function BrandMarquee({ brands }: Readonly<{ brands: Brand[] }>) {
  if (brands.length === 0) return null;
  const reps = Math.max(2, Math.ceil(10 / brands.length));
  const run = Array.from({ length: reps }, () => brands).flat();

  return (
    <section
      data-offscreen
      aria-label="Brands we carry"
      className="mt-20 border-y border-rule py-6 md:mt-28 md:py-8"
    >
      <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="flex w-max animate-[sf-marquee_45s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              aria-hidden={copy === 1 || undefined}
              className="flex shrink-0 gap-14 pr-14"
            >
              {run.map((b, i) => (
                <li
                  key={`${b.id}-${i}`}
                  aria-hidden={copy === 0 && i >= brands.length ? true : undefined}
                >
                  <Link
                    href={`/brand/${b.slug}`}
                    tabIndex={copy === 1 || i >= brands.length ? -1 : undefined}
                    className="inline-block py-2 font-display text-3xl font-bold uppercase tracking-[-0.02em] text-ink/55 transition-colors font-stretch-expanded hover:text-ink md:text-5xl"
                  >
                    {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
