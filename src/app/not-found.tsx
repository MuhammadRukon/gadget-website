import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="sf flex min-h-dvh flex-col items-start justify-center px-6 sm:px-14">
      <div className="mx-auto w-full max-w-3xl border-t border-ink pt-6">
        <p className="text-sm text-ink-2 tabular-nums">Error 404</p>
        <h1 className="mt-3 font-display text-[clamp(2.2rem,6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.025em] font-stretch-expanded">
          This page isn&apos;t here.
        </h1>
        <p className="mt-4 max-w-md text-[15px] text-ink-2">
          It may have moved, been retired, or never existed. The catalog is a good place to start
          again.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild size="lg" className="h-11">
            <Link href="/products">Browse all products</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11">
            <Link href="/">Go to the homepage</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
