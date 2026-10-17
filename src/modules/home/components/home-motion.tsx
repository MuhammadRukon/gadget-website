'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Load GSAP this far ahead of the first pinned section reaching the viewport. */
const PRELOAD_MARGIN = '150% 0px';

/**
 * Scroll choreography for the homepage pins (the earbuds story and the
 * "how buying works" rail). The banner zoom and section reveals are CSS
 * scroll-driven animations (globals.css), so they cost no JavaScript.
 *
 * GSAP is only fetched on screens where the pins run (md+ for the story, lg+
 * for the rail), with motion allowed, and only once a pinned section comes
 * within reach, so phones and the first paint never pay for it. Without JS,
 * or with reduced motion, every section is static and fully visible.
 */
export function HomeMotion({ children }: Readonly<{ children: ReactNode }>) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const wantsMotion = window.matchMedia(
      '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
    );
    if (!wantsMotion.matches) return;

    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-story], [data-rail]'));
    if (targets.length === 0) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void start();
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    targets.forEach((t) => io.observe(t));

    async function start() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled || !el) return;
      gsap.registerPlugin(ScrollTrigger);

      const mm = gsap.matchMedia();
      const q = <T extends Element = HTMLElement>(sel: string) =>
        Array.from(el.querySelectorAll<T & Element>(sel)) as T[];

      mm.add(
        {
          motion: '(prefers-reduced-motion: no-preference)',
          md: '(min-width: 768px)',
          lg: '(min-width: 1024px)',
        },
        (ctx) => {
          const { motion, md, lg } = ctx.conditions as Record<string, boolean>;
          if (!motion) return;
          // Pinned panels start below the header in its compact, scrolled-down shape (a 48px bar).
          const headerOffset = () => 48;

          // Pinned story: one step at a time while the drawing turns.
          const story = el.querySelector<HTMLElement>('[data-story]');
          const steps = q<HTMLElement>('[data-story-step]');
          if (md && story && steps.length > 1) {
            const list = story.querySelector<HTMLElement>('[data-story-steps]');
            const track = story.querySelector<HTMLElement>('[data-story-track]');
            const tallest = Math.max(...steps.map((s) => s.offsetHeight));
            gsap.set(list, { position: 'relative', height: tallest });
            gsap.set(steps, { position: 'absolute', top: 0, left: 0, right: 0, marginTop: 0 });
            gsap.set(steps.slice(1), { autoAlpha: 0, y: 24 });
            gsap.set(track, { display: 'block' });

            const tl = gsap.timeline({
              defaults: { ease: 'power2.inOut' },
              scrollTrigger: {
                trigger: story.querySelector('[data-story-panel]'),
                start: () => `top ${headerOffset() + 16}`,
                end: `+=${steps.length * 70}%`,
                pin: true,
                scrub: 0.6,
              },
            });
            tl.fromTo(
              story.querySelector('[data-story-drawing]'),
              { rotate: -18, scale: 0.86 },
              { rotate: 14, scale: 1.08, duration: steps.length, ease: 'none' },
              0,
            );
            tl.fromTo(
              story.querySelector('[data-story-ring]'),
              { rotate: 0 },
              { rotate: 120, duration: steps.length, ease: 'none' },
              0,
            );
            tl.fromTo(
              story.querySelector('[data-story-progress]'),
              { scaleX: 1 / steps.length },
              { scaleX: 1, duration: steps.length - 1, ease: 'none' },
              0,
            );
            steps.slice(1).forEach((step, i) => {
              tl.to(steps[i], { autoAlpha: 0, y: -24, duration: 0.35 }, i + 0.55);
              tl.to(step, { autoAlpha: 1, y: 0, duration: 0.35 }, i + 0.7);
            });
          }

          // Horizontal rail: vertical scroll drives the track sideways.
          const rail = el.querySelector<HTMLElement>('[data-rail-pin]');
          const railTrack = el.querySelector<HTMLElement>('[data-rail-track]');
          if (lg && rail && railTrack) {
            const distance = () => Math.max(0, railTrack.scrollWidth - rail.clientWidth);
            if (distance() > 0) {
              gsap.to(railTrack, {
                x: () => -distance(),
                ease: 'none',
                scrollTrigger: {
                  trigger: rail,
                  start: () => `top ${headerOffset()}`,
                  end: () => `+=${distance()}`,
                  pin: true,
                  scrub: 0.6,
                  invalidateOnRefresh: true,
                },
              });
            }
          }
        },
      );

      cleanup = () => mm.revert();
    }

    return () => {
      cancelled = true;
      io.disconnect();
      cleanup?.();
    };
  }, []);

  return <div ref={root}>{children}</div>;
}
