import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import type { HomeStory } from '../home-content';

/**
 * Beats-style pinned story on an ink field. On md+ HomeMotion pins the panel
 * and walks the steps while the drawing turns; on phones and with reduced
 * motion the steps simply stack.
 */
export function ScrollStory({ story }: Readonly<{ story: HomeStory }>) {
  return (
    <section aria-labelledby="story" data-story className="mt-20 md:mt-28">
      <div
        data-story-panel
        className="relative overflow-hidden rounded-2xl bg-ink text-paper md:min-h-[min(calc(100dvh-8.5rem),760px)] md:py-16"
      >
        <div className="grid h-full gap-10 px-6 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:px-12 lg:px-16">
          <div className="relative z-10">
            <h2
              id="story"
              className="font-display text-[clamp(2rem,4.6vw,3.75rem)] font-bold leading-[0.95] tracking-[-0.03em] font-stretch-expanded"
            >
              {story.title}
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-paper/70">{story.intro}</p>

            <ol data-story-steps className="mt-10 space-y-6">
              {story.steps.map((step, i) => (
                <li key={step.term} data-story-step className="border-t border-paper/20 pt-4">
                  <p className="flex items-baseline gap-3">
                    <span className="text-xs tabular-nums text-paper/50">
                      {i + 1}/{story.steps.length}
                    </span>
                    <span className="font-display text-2xl font-semibold font-stretch-semi-expanded">
                      {step.term}
                    </span>
                  </p>
                  <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-paper/75">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-8 hidden h-px w-full max-w-sm bg-paper/15" data-story-track>
              <div data-story-progress className="h-px w-full origin-left bg-solder-soft" />
            </div>

            <Link
              href={story.cta.href}
              className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-paper px-6 text-[15px] font-medium text-ink transition-colors hover:bg-solder-soft"
            >
              {story.cta.label}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </div>

          <div aria-hidden className="relative flex items-center justify-center max-md:h-64">
            <div className="absolute aspect-square w-[min(90%,520px)] rounded-full border border-paper/15" />
            <div
              data-story-ring
              className="absolute aspect-square w-[min(62%,360px)] rounded-full border border-dashed border-paper/20"
            />
            <div
              data-story-drawing
              className="relative aspect-square w-[min(70%,420px)] will-change-transform"
            >
              <Image
                src={story.drawing}
                alt=""
                fill
                sizes="420px"
                className="object-contain invert"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
