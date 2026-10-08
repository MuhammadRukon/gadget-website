'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader } from '@/app/common/loader/loader';
import { ApiClientError } from '@/lib/fetcher';
import type { CheckoutInput } from '@/contracts/checkout';
import { queryKeys } from '@/constants/queryKeys';
import {
  checkoutErrorMessage,
  isPaymentMethodUnavailable,
  isTxnIdDuplicate,
} from '@/modules/checkout/checkout-error';
import { useCheckoutQuote, usePaymentConfig, usePlaceOrder } from '@/modules/checkout/hooks';
import { usePaymentSelection } from '@/modules/checkout/use-payment-selection';
import { useCheckoutTxnId } from '@/modules/checkout/use-checkout-txn-id';
import { CheckoutPaymentCard } from '@/modules/checkout/components/checkout-payment-card';
import { OrderSummaryCard } from '@/modules/checkout/components/order-summary-card';
import { useServerCart } from '@/modules/cart/hooks';
import { useAddresses } from '@/modules/account/hooks';
import { AddressForm } from '@/modules/account/components/address-form';

export function CheckoutClient() {
  const router = useRouter();
  const cart = useServerCart('summary');
  const addresses = useAddresses();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [orderPlaced, setOrderPlaced] = useState(false);
  // Synchronous double-click guard: mutate() can fire twice before isPending re-renders.
  const submitGuard = useRef(false);
  const placeOrderMutation = usePlaceOrder();
  const queryClient = useQueryClient();
  const config = usePaymentConfig();

  const configLoading = config.isLoading;
  const { paymentMethod, select: selectPaymentMethod } = usePaymentSelection(
    config.data?.methods,
  );

  useEffect(() => {
    if (!addressId && addresses.data && addresses.data.length > 0) {
      setAddressId(addresses.data[0].id);
    }
  }, [addresses.data, addressId]);

  // Waits for the config so the first quote already carries the payment method.
  const quoteQuery = useCheckoutQuote({
    addressId,
    couponCode: appliedCoupon,
    paymentMethod,
    enabled: !configLoading,
  });
  // A failed quote has no totals, even if an earlier answer for this selection is cached.
  const quote = quoteQuery.isError ? null : (quoteQuery.data ?? null);
  const quoting = quoteQuery.isFetching;

  // React Query v5 has no query-level onError: handle each quote failure once.
  const quoteError = quoteQuery.error;
  const handledQuoteError = useRef<unknown>(null);
  useEffect(() => {
    if (!quoteError || handledQuoteError.current === quoteError) return;
    handledQuoteError.current = quoteError;
    const isApiError = quoteError instanceof ApiClientError;
    toast.error(isApiError ? checkoutErrorMessage(quoteError) : 'Could not calculate totals');
    // The admin turned the method off after the config loaded: refetch the
    // list. The coupon is unrelated, so keep it.
    if (isPaymentMethodUnavailable(quoteError)) {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentConfig });
      return;
    }
    // Quote returns the same stock-conflict 409 as checkout; the cart snapshot is stale.
    if (isApiError && quoteError.status === 409) {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    }
    if (appliedCoupon) setAppliedCoupon(null);
  }, [quoteError, appliedCoupon, queryClient]);

  const itemCount = cart.data?.itemCount ?? 0;

  // Fee UI only reflects a settled quote for COD; while re-quoting, the old
  // quote may belong to a different method.
  const feeRule = quote?.codFeeRule ?? null;
  const feeActive =
    paymentMethod === 'COD' &&
    !!config.data?.cod.feeEnabled &&
    !quoting &&
    !!quote &&
    quote.codFeeCents > 0 &&
    !!feeRule;
  const txn = useCheckoutTxnId(feeActive);

  const ready =
    !!addressId &&
    itemCount > 0 &&
    !quoting &&
    !!quote &&
    !!config.data &&
    !!paymentMethod &&
    !txn.blocksOrder;
  const cartHasIssues = !!cart.data?.hasIssues;

  async function applyCoupon() {
    setAppliedCoupon(couponCode.trim() || null);
  }

  function placeOrder() {
    if (!addressId || !paymentMethod) return;
    if (submitGuard.current) return;
    submitGuard.current = true;
    const customerTxnId = txn.valueToSend;
    placeOrderMutation.mutate(
      {
        addressId,
        paymentMethod,
        couponCode: appliedCoupon ?? undefined,
        notes: notes || undefined,
        ...(customerTxnId ? { customerTxnId } : {}),
      } satisfies CheckoutInput,
      {
        onSuccess: (res) => {
          // Guard stays set while navigating away.
          setOrderPlaced(true);
          if (res.redirectUrl) {
            window.location.href = res.redirectUrl;
            return;
          }
          router.push(`/orders/${res.id}`);
        },
        onError: (err) => {
          submitGuard.current = false;
          if (isTxnIdDuplicate(err)) {
            // Cart is untouched; show the inline message and let them retry without the id.
            txn.markServerDuplicate();
          }
        },
      },
    );
  }

  const submitting = placeOrderMutation.isPending || orderPlaced;

  // After a successful order the cart refetches empty while navigation is in
  // flight; keep the loader up instead of flashing "Your cart is empty".
  if (cart.isLoading || addresses.isLoading || (itemCount === 0 && orderPlaced)) {
    return (
      <div className="flex justify-center py-20">
        <Loader />
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Your cart is empty.{' '}
          <Link href="/products" className="underline">
            Browse products
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  if (cartHasIssues) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          Some items in your cart are no longer available.{' '}
          <Link href="/cart" className="underline">
            Review your cart
          </Link>{' '}
          before continuing.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 py-6">
      <h1 className="text-2xl font-semibold lg:col-span-2">Checkout</h1>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Delivery address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {addresses.data && addresses.data.length > 0 ? (
              <div className="space-y-2">
                {addresses.data.map((addr) => (
                  <label
                    key={addr.id}
                    className={`block cursor-pointer rounded border p-3 ${
                      addressId === addr.id ? 'border-primary' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mr-2"
                      checked={addressId === addr.id}
                      onChange={() => setAddressId(addr.id)}
                    />
                    <span className="font-medium">{addr.recipientName}</span>{' '}
                    <span className="text-muted-foreground">· {addr.recipientPhone}</span>
                    <p className="text-sm text-muted-foreground">
                      {[addr.line1, addr.line2, addr.city, addr.district, addr.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No saved addresses yet. Add one to continue.
              </p>
            )}
            {showAddAddress ? (
              <AddressForm
                onSaved={(saved) => {
                  setAddressId(saved.id);
                  setShowAddAddress(false);
                }}
                onCancel={() => setShowAddAddress(false)}
              />
            ) : (
              <Button variant="outline" onClick={() => setShowAddAddress(true)}>
                Add new address
              </Button>
            )}
          </CardContent>
        </Card>
        <CheckoutPaymentCard
          config={config}
          paymentMethod={paymentMethod}
          onSelect={selectPaymentMethod}
          feeActive={feeActive}
          quote={quote}
          txnFieldProps={txn.fieldProps}
        />
        <Card>
          <CardHeader>
            <CardTitle>Notes (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything special the courier should know?"
            />
          </CardContent>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <OrderSummaryCard
          couponCode={couponCode}
          onCouponCodeChange={setCouponCode}
          appliedCoupon={appliedCoupon}
          onApplyCoupon={applyCoupon}
          quote={quote}
          cartSubtotalCents={cart.data?.subtotalCents}
          feeActive={feeActive}
          placeOrderDisabled={!ready || submitting}
          submitting={submitting}
          onPlaceOrder={placeOrder}
        />
      </aside>
    </section>
  );
}
