import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import type { HomeStep } from '../home-content';

/**
 * oryzo-style horizontal rail. On lg+ HomeMotion pins the section and slides
 * the track sideways as you scroll; below that it is a native swipe rail.
 * Step numbers stay because the order is the content.
 */
export function BuyingSteps({ steps }: Readonly<{ steps: HomeStep[] }>) {
  return (
    <section aria-labelledby="steps" data-rail className="mt-20 md:mt-28">
      <div
        data-rail-pin
        className="lg:flex lg:h-[calc(100dvh-4rem)] lg:max-h-[760px] lg:flex-col lg:justify-center"
      >
        <div className="mb-8 flex items-end justify-between gap-6 border-b border-ink pb-4">
          <h2
            id="steps"
            className="max-w-xl font-display text-[clamp(2rem,4.6vw,3.5rem)] font-bold leading-[0.95] tracking-[-0.03em] font-stretch-expanded"
          >
            How buying works here
          </h2>
          <p className="hidden text-sm text-ink-2 lg:block">Scroll to move along</p>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-14 sm:px-14 lg:mx-0 lg:overflow-hidden lg:px-0">
          <ol data-rail-track className="flex w-max snap-x snap-mandatory gap-4 lg:gap-6">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="flex w-[78vw] max-w-[420px] shrink-0 snap-start flex-col justify-between rounded-2xl border border-rule bg-surface p-6 sm:w-[46vw] lg:h-[420px] lg:w-[420px] lg:p-8"
              >
                <div>
                  <p className="font-display text-[5rem] font-bold leading-none tracking-[-0.04em] text-ink/10 tabular-nums font-stretch-expanded lg:text-[7rem]">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-4 font-display text-2xl font-semibold font-stretch-semi-expanded">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{step.text}</p>
                </div>
                {step.link ? (
                  <Link
                    href={step.link.href}
                    className="group mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-raven-ink"
                  >
                    {step.link.label}
                    <ArrowRight
                      aria-hidden
                      className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
