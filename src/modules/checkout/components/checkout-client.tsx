'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader } from '@/app/common/loader/loader';
import { ApiClientError, apiFetch } from '@/lib/fetcher';
import { formatBDT } from '@/server/common/money';
import type { CheckoutInput, CheckoutQuote } from '@/contracts/checkout';
import { useServerCart } from '@/modules/cart/hooks';
import { useAddresses } from '@/modules/account/hooks';
import { AddressForm } from '@/modules/account/components/address-form';

const PAYMENT_METHODS: Array<{ id: CheckoutInput['paymentMethod']; label: string; hint?: string }> = [
  { id: 'COD', label: 'Cash on delivery (COD)' },
  { id: 'BKASH', label: 'bKash' },
  { id: 'SSLCOMMERZ', label: 'Card / mobile banking (SSLCommerz)' },
  { id: 'BANK_TRANSFER', label: 'Bank transfer (manual verification)' },
];

export function CheckoutClient() {
  const router = useRouter();
  const cart = useServerCart('summary');
  const addresses = useAddresses();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutInput['paymentMethod']>('COD');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    let cancelled = false;
    setQuoting(true);
    apiFetch<CheckoutQuote>('/api/checkout/quote', {
      method: 'POST',
      body: { addressId, couponCode: appliedCoupon ?? undefined },
    })
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiClientError ? err.message : 'Could not calculate totals';
        toast.error(message);
        setQuote(null);
        if (appliedCoupon) setAppliedCoupon(null);
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addressId, appliedCoupon]);

  const itemCount = cart.data?.itemCount ?? 0;
  const ready = !!addressId && itemCount > 0 && !quoting && !!quote;
  const cartHasIssues = !!cart.data?.hasIssues;

  async function applyCoupon() {
    setAppliedCoupon(couponCode.trim() || null);
  }

  async function placeOrder() {
    if (!addressId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        id: string;
        orderNumber: string;
        redirectUrl: string | null;
      }>('/api/checkout', {
        method: 'POST',
        body: {
          addressId,
          paymentMethod,
          couponCode: appliedCoupon ?? undefined,
          notes: notes || undefined,
        } satisfies CheckoutInput,
      });
      toast.success(`Order ${res.orderNumber} placed`);
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      router.push(`/orders/${res.id}`);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Could not place order';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.isLoading || addresses.isLoading) {
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
          Your cart is empty. <Link href="/products" className="underline">Browse products</Link>.
        </CardContent>
      </Card>
    );
  }

  if (cartHasIssues) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          Some items in your cart are no longer available. <Link href="/cart" className="underline">Review your cart</Link> before continuing.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 py-6">
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <Card><CardHeader><CardTitle>Delivery address</CardTitle></CardHeader><CardContent className="space-y-3">
          {addresses.data && addresses.data.length > 0 ? <div className="space-y-2">{addresses.data.map((addr) => (
            <label key={addr.id} className={`block cursor-pointer rounded border p-3 ${addressId === addr.id ? 'border-primary' : ''}`}>
              <input type="radio" name="address" className="mr-2" checked={addressId === addr.id} onChange={() => setAddressId(addr.id)} />
              <span className="font-medium">{addr.recipientName}</span> <span className="text-muted-foreground">· {addr.recipientPhone}</span>
              <p className="text-sm text-muted-foreground">{[addr.line1, addr.line2, addr.city, addr.district, addr.postalCode].filter(Boolean).join(', ')}</p>
            </label>
          ))}</div> : <p className="text-sm text-muted-foreground">No saved addresses yet. Add one to continue.</p>}
          {showAddAddress ? <AddressForm onSaved={(saved) => { setAddressId(saved.id); setShowAddAddress(false); }} onCancel={() => setShowAddAddress(false)} /> : <Button variant="outline" onClick={() => setShowAddAddress(true)}>Add new address</Button>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Payment method</CardTitle></CardHeader><CardContent className="space-y-2">
          {PAYMENT_METHODS.map((method) => (
            <label key={method.id} className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${paymentMethod === method.id ? 'border-primary' : ''}`}>
              <input type="radio" name="payment" checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} />
              <span className="flex-1 text-sm">{method.label}{method.hint ? <span className="text-muted-foreground ml-2 text-xs">({method.hint})</span> : null}</span>
            </label>
          ))}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Notes (optional)</CardTitle></CardHeader><CardContent>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything special the courier should know?" />
        </CardContent></Card>
      </section>
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Card><CardHeader><CardTitle>Order summary</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="space-y-2"><Label htmlFor="coupon">Coupon</Label><div className="flex gap-2">
            <Input id="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Code" />
            <Button type="button" variant="outline" onClick={applyCoupon}>Apply</Button>
          </div>{appliedCoupon ? <p className="text-xs text-muted-foreground">Applied: {appliedCoupon}</p> : null}</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatBDT(quote?.subtotalCents ?? cart.data?.subtotalCents ?? 0)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>- {formatBDT(quote?.discountCents ?? 0)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{quote ? formatBDT(quote.shippingCents) : '...'}</span></div>
            <div className="flex justify-between font-semibold pt-2 border-t mt-2"><span>Total</span><span>{quote ? formatBDT(quote.totalCents) : '...'}</span></div>
          </div>
          <Button className="w-full" size="lg" disabled={!ready || submitting} onClick={placeOrder}>{submitting ? 'Placing order...' : 'Place order'}</Button>
          <p className="text-xs text-muted-foreground">By placing your order you agree to the standard terms of sale.</p>
        </CardContent></Card>
      </aside>
    </div>
  );
}
