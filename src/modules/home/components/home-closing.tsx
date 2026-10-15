import Link from 'next/link';

import type { HOME_CLOSING } from '../home-content';

/** Closing call: oversized statement, one real contact action. */
export function HomeClosing({ closing }: Readonly<{ closing: typeof HOME_CLOSING }>) {
  return (
    <section aria-labelledby="closing" data-reveal className="mt-20 text-center md:mt-28">
      <h2
        id="closing"
        className="mx-auto max-w-4xl font-display text-[clamp(2.6rem,8vw,6.5rem)] font-bold leading-[0.9] tracking-[-0.035em] font-stretch-expanded text-balance"
      >
        {closing.title}
      </h2>
      <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">{closing.text}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href={closing.whatsapp.href}
          className="inline-flex h-12 items-center rounded-full bg-raven px-6 text-[15px] font-medium text-on-raven transition-colors hover:bg-raven-ink"
        >
          {closing.whatsapp.label}
        </a>
        <Link
          href={closing.contact.href}
          className="inline-flex h-12 items-center px-3 text-[15px] font-medium text-raven-ink underline"
        >
          {closing.contact.label}
        </Link>
      </div>
    </section>
  );
}
