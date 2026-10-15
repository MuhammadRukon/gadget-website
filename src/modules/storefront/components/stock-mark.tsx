import { cn } from '@/lib/utils';

/** In/out of stock as a dot plus words, so the state never relies on colour alone. */
export function StockMark({
  inStock,
  className,
}: Readonly<{ inStock: boolean; className?: string }>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        inStock ? 'text-solder-ink' : 'text-ink-2',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          inStock ? 'bg-solder' : 'border border-ink-2 bg-transparent',
        )}
      />
      {inStock ? 'In stock' : 'Out of stock'}
    </span>
  );
}
