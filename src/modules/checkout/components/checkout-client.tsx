'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader } from '@/app/common/loader/loader';
import { ApiClientError, apiFetch } from '@/lib/fetcher';
import { formatBDT } from '@/server/common/money';
import { buildCodFeeWarning } from '@/server/checkout/cod-fee';
import type { CheckoutInput, CheckoutQuote } from '@/contracts/checkout';
import { queryKeys } from '@/constants/queryKeys';
import {
  checkoutErrorMessage,
  isPaymentMethodUnavailable,
  isTxnIdDuplicate,
} from '@/modules/checkout/checkout-error';
import { usePaymentConfig, usePlaceOrder } from '@/modules/checkout/hooks';
import {
  PAYMENT_METHOD_INFO,
  defaultPaymentMethod,
  effectiveSelection,
} from '@/modules/checkout/payment-methods';
import { parseTxnIdInput } from '@/modules/checkout/txn-id';
import { CodFeeNotice } from '@/modules/checkout/components/cod-fee-notice';
import { TxnIdField } from '@/modules/checkout/components/txn-id-field';
import { useServerCart } from '@/modules/cart/hooks';
import { useAddresses } from '@/modules/account/hooks';
import { AddressForm } from '@/modules/account/components/address-form';
import { cn } from '@/lib/utils';

export function CheckoutClient() {
  const router = useRouter();
  const cart = useServerCart('summary');
  const addresses = useAddresses();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  // undefined = no pick yet; pinned to the default once the config loads, and
  // resolved to null if the picked method later disappears from the config.
  const [selectedMethod, setSelectedMethod] = useState<
    CheckoutInput['paymentMethod'] | null | undefined
  >(undefined);
  const [txnId, setTxnId] = useState('');
  const [txnDuplicate, setTxnDuplicate] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  // Synchronous double-click guard: mutate() can fire twice before isPending re-renders.
  const submitGuard = useRef(false);
  const placeOrderMutation = usePlaceOrder();
  const queryClient = useQueryClient();
  const config = usePaymentConfig();

  const configLoading = config.isLoading;
  const methods = config.data?.methods;
  const paymentMethod = effectiveSelection(selectedMethod, methods ?? []);

  useEffect(() => {
    if (methods && selectedMethod === undefined) {
      setSelectedMethod(defaultPaymentMethod(methods));
    }
  }, [methods, selectedMethod]);

  useEffect(() => {
    if (!addressId && addresses.data && addresses.data.length > 0) {
      setAddressId(addresses.data[0].id);
    }
  }, [addresses.data, addressId]);

  useEffect(() => {
    if (!addressId) {
      setQuote(null);
      return;
    }
    // Wait for the config so the first quote already carries the payment method.
    if (configLoading) return;
    let cancelled = false;
    setQuoting(true);
    apiFetch<CheckoutQuote>('/api/checkout/quote', {
      method: 'POST',
      body: {
        addressId,
        couponCode: appliedCoupon ?? undefined,
        paymentMethod: paymentMethod ?? undefined,
      },
    })
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch((err) => {
        if (cancelled) return;
        const isApiError = err instanceof ApiClientError;
        toast.error(isApiError ? checkoutErrorMessage(err) : 'Could not calculate totals');
        setQuote(null);
        // The admin turned the method off after the config loaded: refetch the
        // list. The coupon is unrelated, so keep it.
        if (isPaymentMethodUnavailable(err)) {
          queryClient.invalidateQueries({ queryKey: queryKeys.paymentConfig });
          return;
        }
        // Quote returns the same stock-conflict 409 as checkout; the cart snapshot is stale.
        if (isApiError && err.status === 409) {
          queryClient.invalidateQueries({ queryKey: queryKeys.cart });
        }
        if (appliedCoupon) setAppliedCoupon(null);
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addressId, appliedCoupon, paymentMethod, configLoading, queryClient]);

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
  const txnInput = parseTxnIdInput(txnId);
  // A non-empty id the server would reject (422) blocks the order until fixed or cleared.
  const txnBlocksOrder = feeActive && txnInput.status === 'invalid';

  const ready =
    !!addressId &&
    itemCount > 0 &&
    !quoting &&
    !!quote &&
    !!config.data &&
    !!paymentMethod &&
    !txnBlocksOrder;
  const cartHasIssues = !!cart.data?.hasIssues;

  async function applyCoupon() {
    setAppliedCoupon(couponCode.trim() || null);
  }

  function placeOrder() {
    if (!addressId || !paymentMethod) return;
    if (submitGuard.current) return;
    submitGuard.current = true;
    // Only a valid id that the blur check did not flag as existing is sent.
    const customerTxnId =
      feeActive && !txnDuplicate && txnInput.status === 'valid' ? txnInput.value : undefined;
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
            setTxnId('');
            setTxnDuplicate(true);
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
        <Card>
          <CardHeader>
            <CardTitle>Payment method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading payment methods...</p>
            ) : config.isError || !config.data ? (
              <Alert variant="destructive">
                <AlertDescription className="items-start gap-2 text-destructive">
                  <p>We could not load the payment methods.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void config.refetch()}
                    disabled={config.isFetching}
                  >
                    {config.isFetching ? 'Retrying...' : 'Retry'}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : config.data.methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payment methods are available right now. Please try again later.
              </p>
            ) : (
              config.data.methods.map((method) => {
                const info = PAYMENT_METHOD_INFO[method];
                return (
                  <label
                    key={method}
                    className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${
                      paymentMethod === method ? 'border-primary' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === method}
                      onChange={() => setSelectedMethod(method)}
                    />
                    <span className="flex-1 text-sm">
                      {info.label}
                      {info.hint ? (
                        <span className="text-muted-foreground ml-2 text-xs">({info.hint})</span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
            {config.data && config.data.methods.length > 0 && !paymentMethod ? (
              <p className="text-sm text-destructive">Choose a payment method to continue.</p>
            ) : null}
            {feeActive && config.data && feeRule && quote ? (
              <div className="space-y-4 pt-2">
                <CodFeeNotice
                  warning={buildCodFeeWarning({
                    type: feeRule.type,
                    value: feeRule.value,
                    feeCents: quote.codFeeCents,
                    contactNumber: config.data.contactNumber,
                  })}
                  qrImageUrl={config.data.qrImageUrl}
                  contactNumber={config.data.contactNumber}
                  paymentNote={config.data.paymentNote}
                />
                <TxnIdField
                  value={txnId}
                  onChange={setTxnId}
                  duplicate={txnDuplicate}
                  onDuplicateChange={setTxnDuplicate}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
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
        <Card>
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="coupon">Coupon</Label>
              <div className="flex gap-2">
                <Input
                  id="coupon"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.trim())}
                  placeholder="Code"
                  className="w-full"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyCoupon}
                  disabled={!couponCode}
                  className={cn('px-6 ', couponCode ? '!bg-black !border-black' : 'opacity-50')}
                >
                  Apply
                </Button>
              </div>
              {appliedCoupon ? (
                <p className="text-xs text-muted-foreground">Applied: {appliedCoupon}</p>
              ) : null}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatBDT(quote?.subtotalCents ?? cart.data?.subtotalCents ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>- {formatBDT(quote?.discountCents ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{quote ? formatBDT(quote.shippingCents) : '...'}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t mt-2">
                <span>Total</span>
                <span>{quote ? formatBDT(quote.totalCents) : '...'}</span>
              </div>
              {feeActive && quote ? (
                <>
                  <div className="flex justify-between">
                    <span>Confirmation fee (advance)</span>
                    <span>{formatBDT(quote.codFeeCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Due on delivery</span>
                    <span>{formatBDT(quote.dueOnDeliveryCents)}</span>
                  </div>
                </>
              ) : null}
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={!ready || submitting}
              onClick={placeOrder}
            >
              {submitting ? 'Placing order...' : 'Place order'}
            </Button>
            <p className="text-xs text-muted-foreground">
              By placing your order you agree to the standard terms of sale.
            </p>
          </CardContent>
        </Card>
      </aside>
    </section>
  );
}
