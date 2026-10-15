'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalAppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // We log to console here; the server-side equivalent already
    // captures via the structured logger in jsonError().
    console.error('app.error.boundary', { error: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="sf flex min-h-[60vh] flex-col items-start justify-center px-6 py-16 sm:px-14">
      <div className="mx-auto w-full max-w-3xl border-t border-ink pt-6">
        <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.95] tracking-[-0.025em] font-stretch-expanded">
          This page didn&apos;t load.
        </h1>
        <p className="mt-4 max-w-md text-[15px] text-muted-foreground">
          Something went wrong on our side while building it. Try again, or go back to the homepage.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted-foreground/70 font-mono">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-2">
          <Button size="lg" className="h-11" onClick={() => reset()}>
            Try again
          </Button>
          <Button size="lg" className="h-11" variant="outline" asChild>
            <Link href="/">Go to the homepage</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
