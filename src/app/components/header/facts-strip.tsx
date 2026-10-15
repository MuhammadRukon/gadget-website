import Link from 'next/link';
import { JSX } from 'react';

import { Container } from '@/app/components/container/container';
import { PAYMENT_METHOD_SHORT_LABEL } from '@/modules/checkout/payment-methods';
import { formatBDT } from '@/server/common/money';
import type { StorefrontFacts } from '@/server/storefront/storefront-facts.service';

/** Delivery and payment terms, always in view before anyone reaches checkout. */
export function FactsStrip({ facts }: Readonly<{ facts: StorefrontFacts }>): JSX.Element {
  const { shipping, methods } = facts;
  const pay = methods.map((m) => PAYMENT_METHOD_SHORT_LABEL[m]).join(', ');

  return (
    <div className="bg-ink text-paper">
      <Container>
        <p className="flex h-9 items-center gap-x-5 overflow-x-auto whitespace-nowrap text-xs [scrollbar-width:none]">
          <span>
            <span className="font-semibold">Free delivery</span> from{' '}
            {formatBDT(shipping.freeFromCents)}
          </span>
          <span className="max-sm:hidden" aria-hidden>
            /
          </span>
          <span className="max-sm:hidden">
            Delivery {formatBDT(shipping.insideDhakaCents)} in Dhaka,{' '}
            {formatBDT(shipping.outsideDhakaCents)} elsewhere
          </span>
          {pay ? (
            <>
              <span aria-hidden>/</span>
              <span>Pay by {pay}</span>
            </>
          ) : null}
          <Link
            href="/refund-policy"
            className="ml-auto underline decoration-paper/40 hover:decoration-paper max-md:hidden"
          >
            Returns &amp; refunds
          </Link>
        </p>
      </Container>
    </div>
  );
}
