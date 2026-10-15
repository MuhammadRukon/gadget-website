'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Scroll choreography for the homepage, applied to markup the server already
 * rendered (found by data attributes). GSAP loads only on this page, after
 * hydration. Without JS, or with reduced motion, every section is static and
 * fully visible: animations only start from states GSAP sets itself.
 */
export function HomeMotion({ children }: Readonly<{ children: ReactNode }>) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
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
          const ease = 'expo.out';
          // Pinned panels start below the header in its compact, scrolled-down shape (a 48px bar).
          const headerOffset = () => 48;

          // Banner: the image settles out of a slow zoom as you scroll past it. The statement
          // itself never animates: it is the first thing people read and it must not flash.
          const frame = el.querySelector('[data-banner-frame]');
          const image = el.querySelector('[data-banner-image]');
          if (frame && image) {
            gsap.fromTo(
              image,
              { scale: 1.16, yPercent: -4 },
              {
                scale: 1,
                yPercent: 6,
                ease: 'none',
                scrollTrigger: {
                  trigger: frame,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: true,
                },
              },
            );
          }

          // Section reveals.
          for (const node of q('[data-reveal]')) {
            gsap.from(node, {
              y: 40,
              opacity: 0,
              duration: 1,
              ease,
              scrollTrigger: { trigger: node, start: 'top 85%' },
            });
          }
          for (const group of q('[data-reveal-group]')) {
            gsap.from(group.querySelectorAll('[data-reveal-item]'), {
              y: 48,
              opacity: 0,
              duration: 1,
              ease,
              stagger: 0.07,
              scrollTrigger: { trigger: group, start: 'top 85%' },
            });
          }

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

          // Parallax on anything that opts in.
          for (const node of q<HTMLElement>('[data-parallax]')) {
            const amount = Number(node.dataset.parallax) || 10;
            gsap.fromTo(
              node,
              { yPercent: -amount },
              {
                yPercent: amount,
                ease: 'none',
                scrollTrigger: {
                  trigger: node,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: true,
                },
              },
            );
          }
        },
      );

      cleanup = () => mm.revert();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <div ref={root}>{children}</div>;
}
