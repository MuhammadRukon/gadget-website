import { formatBDT } from '@/server/common/money';
import { cn } from '@/lib/utils';

interface PriceProps {
  cents: number;
  originalCents?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Show "Save Tk X" beside a discounted price. */
  showSaving?: boolean;
  className?: string;
}

const SIZE = {
  sm: 'text-[15px]',
  md: 'text-lg',
  lg: 'text-3xl md:text-4xl',
} as const;

/** Storefront price: wide display figures, never wraps between "Tk" and the amount. */
export function Price({
  cents,
  originalCents,
  size = 'md',
  showSaving,
  className,
}: Readonly<PriceProps>) {
  const discounted = originalCents !== undefined && cents < originalCents;

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2.5 gap-y-1', className)}>
      <span
        className={cn(
          'font-display font-semibold font-stretch-semi-expanded tabular-nums whitespace-nowrap tracking-[-0.01em]',
          SIZE[size],
        )}
      >
        {formatBDT(cents)}
      </span>
      {discounted ? (
        <>
          <s className="whitespace-nowrap text-sm text-ink-2 tabular-nums">
            <span className="sr-only">Was </span>
            {formatBDT(originalCents)}
          </s>
          {showSaving ? (
            <span className="whitespace-nowrap text-sm font-medium text-sale">
              Save {formatBDT(originalCents - cents)}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
