'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Props {
  page: number;
  pageSize: number;
  total: number;
}

const LINK =
  'inline-flex h-11 items-center gap-2 rounded-md border border-rule-strong bg-surface px-4 text-sm font-medium transition-colors hover:border-ink-2';

export function StorefrontPagination({ page, pageSize, total }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function withPage(next: number): string {
    const sp = new URLSearchParams(params);
    if (next <= 1) sp.delete('page');
    else sp.set('page', String(next));
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between gap-4 border-t border-rule pt-5"
    >
      {page > 1 ? (
        <Link href={withPage(page - 1)} prefetch={false} className={LINK} rel="prev">
          <ArrowLeft aria-hidden className="size-4" />
          Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink-2 tabular-nums">
        {from}–{to} of {total}
      </p>
      {page < totalPages ? (
        <Link href={withPage(page + 1)} prefetch={false} className={LINK} rel="next">
          Next
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
