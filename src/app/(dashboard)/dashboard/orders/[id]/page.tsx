'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { CodFeeStatus, OrderStatus } from '@prisma/client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/app/common/loader/loader';
import { Textarea } from '@/components/ui/textarea';
import { formatBDT } from '@/server/common/money';
import { dueOnDeliveryCents } from '@/server/checkout/cod-fee';
import { OrderStatusBadge } from '@/modules/orders/components/order-status-badge';
import { CodFeePanel, hasCodFee } from '@/modules/admin/payments/components/cod-fee-panel';

import { useAdminOrderDetail, useTransitionOrder } from '@/modules/admin/orders/hooks';

const STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

const getNextStatus = (current: OrderStatus): OrderStatus | null => {
  const index = STATUSES.indexOf(current);
  return index >= 0 && index < STATUSES.length - 1 ? STATUSES[index + 1] : null;
};

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const order = useAdminOrderDetail(id);
  const transition = useTransitionOrder(id ?? '');
  const [note, setNote] = useState('');
  const [waiveOpen, setWaiveOpen] = useState(false);

  if (order.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader />
      </div>
    );
  }
  if (order.error || !order.data) {
    return (
      <div className="p-6">
        <p>Could not load this order.</p>
        <Link href="/dashboard/orders" className="underline">
          Back to orders
        </Link>
      </div>
    );
  }

  const o = order.data;
  const nextStatus = getNextStatus(o.status);
  const feePayment = hasCodFee(o.payments[0]) ? o.payments[0] : null;
  // Confirming by hand while the fee is unverified (or rejected) waives it server-side.
  const confirmWaivesFee =
    o.status === OrderStatus.PENDING &&
    !!feePayment &&
    (feePayment.feeStatus === CodFeeStatus.PENDING ||
      feePayment.feeStatus === CodFeeStatus.REJECTED);

  function runTransition(status: OrderStatus) {
    transition.mutate({ status, note: note || undefined }, { onSuccess: () => setNote('') });
  }
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Order {o.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Placed {new Date(o.createdAt).toLocaleString()}
          </p>
        </div>
        <OrderStatusBadge status={o.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{o.shipRecipient}</p>
            <p>{o.user?.email}</p>
            <p>{o.shipPhone}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              {[o.shipLine1, o.shipLine2, o.shipCity, o.shipDistrict, o.shipPostal, o.shipCountry]
                .filter(Boolean)
                .join(', ')}
            </p>
          </CardContent>
        </Card>
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

      {feePayment ? <CodFeePanel order={o} payment={feePayment} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
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
            {feePayment && feePayment.feeCents > 0 ? (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Confirmation fee (advance)</span>
                  <span>{formatBDT(feePayment.feeCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Due on delivery</span>
                  <span>{formatBDT(
                      dueOnDeliveryCents({
                        totalCents: o.totalCents,
                        feeCents: feePayment.feeCents,
                        feeStatus: feePayment.feeStatus,
                      }),
                    )}</span>
                </div>
              </>
            ) : null}
            <p className="pt-2 text-xs text-muted-foreground">
              Payment: {o.payments.map((p) => `${p.method} (${p.status})`).join(', ') || 'Pending'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (visible to the customer)"
            />
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => {
                const isNext = s === nextStatus;
                const isCancelled = s === OrderStatus.CANCELLED;

                return (
                  <Button
                    key={s}
                    size="sm"
                    variant={o.status === s ? 'default' : 'outline'}
                    disabled={o.status === s || transition.isPending || (!isNext && !isCancelled)}
                    onClick={() => {
                      if (s === OrderStatus.CONFIRMED && confirmWaivesFee) {
                        setWaiveOpen(true);
                        return;
                      }
                      runTransition(s);
                    }}
                  >
                    {s}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={waiveOpen}
        onOpenChange={setWaiveOpen}
        title="Confirmation fee not verified"
        description="Confirmation fee not verified. Confirming will waive it. The order will be confirmed and the fee marked as waived."
        confirmLabel="Confirm and waive fee"
        onConfirm={() => runTransition(OrderStatus.CONFIRMED)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
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
    </div>
  );
}
