'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { OrderStatus } from '@prisma/client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/app/common/loader/loader';
import { Textarea } from '@/components/ui/textarea';
import { formatBDT } from '@/server/common/money';
import { useCancelOrder, useOrderDetail } from '@/modules/orders/hooks';
import { OrderStatusBadge } from '@/modules/orders/components/order-status-badge';
import { useSubmitWarranty } from '@/modules/warranty/hooks';

const CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING'];

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { status } = useSession();
  const order = useOrderDetail(id);
  const cancel = useCancelOrder(id ?? '');
  const warranty = useSubmitWarranty(id ?? '');
  const [reason, setReason] = useState('');
  const [warrantyReason, setWarrantyReason] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=/orders/${id ?? ''}`);
    }
  }, [status, router, id]);

  if (status !== 'authenticated' || order.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader />
      </div>
    );
  }
  if (order.error || !order.data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          We couldn&apos;t load this order.{' '}
          <Link href="/account/orders" className="underline">
            View all orders
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  const o = order.data;
  const canCancel = CANCELLABLE.includes(o.status);
  const canRequestWarranty = o.status === 'DELIVERED';

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Order {o.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Placed on {new Date(o.createdAt).toLocaleString()}
          </p>
        </div>
        <OrderStatusBadge status={o.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {o.items.map((it) => (
              <li key={it.id} className="flex gap-4 py-3">
                <div className="relative w-16 h-16 bg-muted rounded overflow-hidden shrink-0">
                  {it.imageUrl ? (
                    <Image src={it.imageUrl} alt={it.productName} fill className="object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-1">{it.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.variantName ? `${it.variantName} · ` : ''}SKU: {it.sku}
                  </p>
                  <p className="text-sm">
                    {it.quantity} × {formatBDT(it.unitPriceCents)}
                  </p>
                </div>
                <div className="text-sm font-medium">
                  {formatBDT(it.unitPriceCents * it.quantity)}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{o.shipRecipient}</p>
            <p className="text-muted-foreground">{o.shipPhone}</p>
            <p className="text-muted-foreground">
              {[o.shipLine1, o.shipLine2, o.shipCity, o.shipDistrict, o.shipPostal, o.shipCountry]
                .filter(Boolean)
                .join(', ')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatBDT(o.subtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount {o.couponCode ? `(${o.couponCode})` : ''}</span>
              <span>- {formatBDT(o.discountCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{formatBDT(o.shippingCents)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2 font-semibold">
              <span>Total</span>
              <span>{formatBDT(o.totalCents)}</span>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Payment:{' '}
              {o.payments[0]
                ? `${o.payments[0].method} (${o.payments[0].status})`
                : 'Pending'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {o.events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <OrderStatusBadge status={e.status} />
                <div>
                  <p>{e.note ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {canCancel ? (
        <Card>
          <CardHeader>
            <CardTitle>Cancel order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us why you'd like to cancel"
            />
            <Button
              variant="destructive"
              disabled={reason.trim().length < 2 || cancel.isPending}
              onClick={() => cancel.mutate(reason.trim())}
            >
              {cancel.isPending ? 'Cancelling...' : 'Cancel order'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canRequestWarranty ? (
        <Card>
          <CardHeader>
            <CardTitle>Request warranty service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Describe the issue with your order. Our team will review and respond, usually
              within two business days.
            </p>
            <Textarea
              rows={4}
              value={warrantyReason}
              onChange={(e) => setWarrantyReason(e.target.value)}
              placeholder="Describe the defect, when it started, and any troubleshooting you've tried."
            />
            <Button
              disabled={warrantyReason.trim().length < 20 || warranty.isPending}
              onClick={async () => {
                await warranty.mutateAsync(warrantyReason.trim());
                setWarrantyReason('');
              }}
            >
              {warranty.isPending ? 'Submitting...' : 'Submit warranty request'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
