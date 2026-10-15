'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';

import { AddToCartButton } from '@/modules/cart/components/add-to-cart-button';
import { PAYMENT_METHOD_SHORT_LABEL } from '@/modules/checkout/payment-methods';
import type { PublicProductVariant } from '@/contracts/catalog';
import { cn } from '@/lib/utils';
import { formatBDT } from '@/server/common/money';
import type { StorefrontFacts } from '@/server/storefront/storefront-facts.service';
import { Price } from './price';
import { StockMark } from './stock-mark';

interface ProductDetailPurchasePanelProps {
  variants: PublicProductVariant[];
  warrantyMonths: number;
  facts: StorefrontFacts;
}

function variantLabel(v: PublicProductVariant): string {
  if (v.name) return v.name;
  const attrs = Object.values(v.attributes);
  if (attrs.length > 0) return attrs.join(' / ');
  return v.sku;
}

/**
 * Price, options, add to cart, then the terms and the spec ledger for the
 * selected option. Everything here follows the selected variant.
 */
export function ProductDetailPurchasePanel({
  variants,
  warrantyMonths,
  facts,
}: ProductDetailPurchasePanelProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants.find((v) => v.inStock)?.id ?? variants[0]?.id ?? null,
  );
  const [added, setAdded] = useState(false);
  // Mobile: once the main button scrolls out of view, a bottom bar keeps price and add-to-cart in reach.
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const variant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );

  const hasMultipleVariants = variants.length > 1;
  const inStock = !!variant && variant.inStock;
  const freeDelivery = !!variant && variant.priceCents >= facts.shipping.freeFromCents;
  const specs = variant ? Object.entries(variant.attributes) : [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 pt-5">
        {variant ? (
          <Price
            cents={variant.priceCents}
            originalCents={variant.originalPriceCents}
            size="lg"
            showSaving
          />
        ) : (
          <p className="text-sm text-ink-2">This product is not available right now.</p>
        )}
        {variant ? <StockMark inStock={variant.inStock} className="text-sm" /> : null}
      </div>

      {hasMultipleVariants ? (
        <fieldset className="mt-6">
          <legend className="mb-2.5 text-sm font-medium">
            Option
            <span className="text-ink-2">
              : {variant ? variantLabel(variant) : 'none selected'}
            </span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {variants.map((v) => {
              const active = selectedVariantId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedVariantId(v.id);
                    setAdded(false);
                  }}
                  className={cn(
                    'relative flex min-h-14 flex-col items-start justify-center rounded-md border px-3 py-2 text-left transition-colors',
                    active
                      ? 'border-raven bg-raven-soft ring-1 ring-raven'
                      : 'border-rule-strong bg-surface hover:border-ink-2',
                    !v.inStock && 'text-ink-2',
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-medium leading-tight',
                      !v.inStock && 'line-through decoration-ink-2/60',
                    )}
                  >
                    {variantLabel(v)}
                  </span>
                  <span className="mt-0.5 text-xs tabular-nums text-ink-2">
                    {v.inStock ? formatBDT(v.priceCents) : 'Out of stock'}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div ref={ctaRef} className="mt-6 space-y-2">
        <AddToCartButton
          variantId={variant?.id ?? null}
          disabled={!inStock}
          className="h-12 w-full text-[15px]"
          label={inStock ? 'Add to cart' : 'Out of stock'}
          onAdded={() => setAdded(true)}
        />
        <p className="min-h-6 text-sm" aria-live="polite">
          {added ? (
            <span className="inline-flex items-center gap-1.5 text-raven-ink">
              <Check aria-hidden className="size-4" />
              Added.{' '}
              <Link href="/cart" className="font-medium underline">
                Review cart and checkout
              </Link>
            </span>
          ) : null}
        </p>
      </div>

      {variant ? (
        <div
          aria-hidden={ctaVisible}
          inert={ctaVisible}
          className={cn(
            'fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_oklch(0.2_0.02_165/0.2)] transition-transform duration-300 ease-out lg:hidden',
            ctaVisible ? 'pointer-events-none translate-y-full' : 'translate-y-0',
          )}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-ink-2">
                {hasMultipleVariants ? variantLabel(variant) : 'Price'}
              </p>
              <p className="whitespace-nowrap font-display text-lg font-semibold tabular-nums font-stretch-semi-expanded">
                {formatBDT(variant.priceCents)}
              </p>
            </div>
            <AddToCartButton
              variantId={variant.id}
              disabled={!inStock}
              className="h-12 px-6"
              label={inStock ? 'Add to cart' : 'Out of stock'}
              onAdded={() => setAdded(true)}
            />
          </div>
        </div>
      ) : null}

      <dl className="mt-4 divide-y divide-rule border-y border-rule text-sm">
        <TermRow term="Delivery">
          {freeDelivery ? (
            <>Free delivery on this item.</>
          ) : (
            <>
              {formatBDT(facts.shipping.insideDhakaCents)} inside Dhaka,{' '}
              {formatBDT(facts.shipping.outsideDhakaCents)} elsewhere. Free from{' '}
              {formatBDT(facts.shipping.freeFromCents)}.
            </>
          )}
        </TermRow>
        {facts.methods.length > 0 ? (
          <TermRow term="Payment">
            {facts.methods.map((m) => PAYMENT_METHOD_SHORT_LABEL[m]).join(', ')}
          </TermRow>
        ) : null}
        <TermRow term="Warranty">
          {warrantyMonths > 0 ? `${warrantyMonths} months` : 'No warranty listed'}
        </TermRow>
        <TermRow term="Returns">
          <Link href="/refund-policy" className="underline hover:text-raven-ink">
            Refund and return policy
          </Link>
        </TermRow>
      </dl>

      {specs.length > 0 || variant ? (
        <section aria-labelledby="specs" className="mt-10">
          <h2
            id="specs"
            className="mb-3 font-display text-lg font-semibold font-stretch-semi-expanded"
          >
            Specifications
          </h2>
          <dl className="border-t border-ink text-sm">
            {specs.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-4 border-b border-rule py-2.5"
              >
                <dt className="text-ink-2">{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
            {variant ? (
              <div className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-4 border-b border-rule py-2.5">
                <dt className="text-ink-2">SKU</dt>
                <dd className="font-mono text-[13px]">{variant.sku}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function TermRow({ term, children }: Readonly<{ term: string; children: React.ReactNode }>) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-3">
      <dt className="font-medium">{term}</dt>
      <dd className="text-ink-2">{children}</dd>
    </div>
  );
}
