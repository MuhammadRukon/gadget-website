import Image from 'next/image';
import Link from 'next/link';
import { JSX } from 'react';

import { Container } from '../container/container';
import { PAYMENT_METHOD_SHORT_LABEL } from '@/modules/checkout/payment-methods';
import type { MenuCategory } from '../menu/menu.types';
import { formatBDT } from '@/server/common/money';
import type { StorefrontFacts } from '@/server/storefront/storefront-facts.service';

const HELP_LINKS: [string, string][] = [
  ['Contact us', '/contact'],
  ['Refund and return policy', '/refund-policy'],
  ['Terms and conditions', '/terms'],
  ['Privacy policy', '/privacy-policy'],
  ['About Ravntech', '/about'],
];

interface FooterProps {
  menu: MenuCategory[];
  // facts: StorefrontFacts;
}

export function Footer({ menu }: Readonly<FooterProps>): JSX.Element {
  // export function Footer({ menu, facts }: Readonly<FooterProps>): JSX.Element {
  // const { shipping, methods } = facts;

  return (
    <footer data-offscreen className="mt-20 border-t border-rule bg-surface text-sm">
      <Container>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 sm:grid-cols-3 sm:gap-x-10 sm:py-12 lg:grid-cols-[1fr_1fr_1.4fr]">
          <nav aria-label="Shop" className="min-w-0">
            <h2 className="mb-2 text-xs font-semibold text-ink-2 sm:mb-4">Shop</h2>
            <ul className="">
              <li>
                <Link
                  href="/products"
                  className="inline-flex min-h-11 items-center hover:text-raven-ink hover:underline"
                >
                  All products
                </Link>
              </li>
              {menu.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="inline-flex min-h-11 items-center hover:text-raven-ink hover:underline"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Help" className="min-w-0">
            <h2 className="mb-2 text-xs font-semibold text-ink-2 sm:mb-4">Help</h2>
            <ul className="">
              {HELP_LINKS.map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-flex min-h-11 items-center hover:text-raven-ink hover:underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* On phones the contact block leads, full width, with Shop and Help side by side beneath it. */}
          <div className="col-span-2 order-first min-w-0 border-b border-rule pb-8 sm:order-none sm:col-span-1 sm:border-b-0 sm:pb-0">
            <h2 className="mb-4 text-xs font-semibold text-ink-2">Talk to us</h2>
            <address className="space-y-3 not-italic">
              <p>
                <a
                  href="whatsapp://send?phone=+8801815780053"
                  className="hover:text-raven-ink hover:underline"
                >
                  +01815780053
                </a>
                <span className="block text-xs text-ink-2">Phone and WhatsApp</span>
              </p>
              <p>
                <a
                  href="mailto:muhammad.rukon242@gmail.com"
                  className="break-all hover:text-raven-ink hover:underline"
                >
                  muhammad.rukon242@gmail.com
                </a>
              </p>
              <p className="text-ink-2">Tali Office Road, Hazaribagh, Dhaka-1209</p>
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center font-medium text-raven-ink underline"
              >
                Complaint or advice
              </Link>
            </address>
          </div>
        </div>

        <p className="border-t border-rule py-5 text-center text-xs text-ink-2">
          © {new Date().getFullYear()} Ravntech Ltd. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
