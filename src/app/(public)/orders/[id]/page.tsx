'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CheckCircle2Icon } from 'lucide-react';
import { OrderStatus, type Payment } from '@prisma/client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/app/common/loader/loader';
import { Textarea } from '@/components/ui/textarea';
import { formatBDT } from '@/server/common/money';
import { buildCodFeeWarning, dueOnDeliveryCents } from '@/server/checkout/cod-fee';
import { AddTxnIdCard } from '@/modules/checkout/components/add-txn-id-card';
import { CodFeeNotice } from '@/modules/checkout/components/cod-fee-notice';
import {
  buildFeeRejectedMessage,
  getFeeNoticeState,
  type FeeNoticeState,
} from '@/modules/checkout/fee-state';
import { usePaymentConfig } from '@/modules/checkout/hooks';
import { useCancelOrder, useOrderDetail } from '@/modules/orders/hooks';
import { OrderStatusBadge } from '@/modules/orders/components/order-status-badge';
import { useSubmitWarranty } from '@/modules/warranty/hooks';

const CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING'];

type PaymentConfigQuery = ReturnType<typeof usePaymentConfig>;

/** Read-only display of the submitted id. Never an input: it is add-only. */
function SubmittedTxnId({ payment }: { payment: Payment }) {
  if (!payment.customerTxnId) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction ID</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="break-all font-mono">{payment.customerTxnId}</p>
        {payment.txnSubmittedAt ? (
          <p className="text-xs text-muted-foreground">
            Submitted {new Date(payment.txnSubmittedAt).toLocaleString()}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * COD confirmation-fee state. The warning is built from the Payment snapshot
 * (feeType/feeValue/feeCents), so it stays correct if the admin later changes
 * or disables the fee; only contact, QR and note come from live config.
 */
function FeeSection({
  state,
  payment,
  config,
}: {
  state: Exclude<FeeNoticeState, 'none'>;
  payment: Payment;
  config: PaymentConfigQuery;
}) {
  const contact = config.data?.contactNumber ?? null;

  if (state === 'verified') {
    return (
      <Alert>
        <CheckCircle2Icon />
        <AlertTitle className="line-clamp-none">Confirmation fee verified</AlertTitle>
      </Alert>
    );
  }

  if (state === 'rejected') {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription className="text-destructive">
            {buildFeeRejectedMessage(contact)}
          </AlertDescription>
        </Alert>
        <SubmittedTxnId payment={payment} />
      </div>
    );
  }

  if (config.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading payment details...</p>;
  }

  if (config.isError || !config.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="items-start gap-2 text-destructive">
          <p>We could not load the payment details for your confirmation fee.</p>
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
    );
  }

  return (
    <div className="space-y-4">
      <CodFeeNotice
        warning={buildCodFeeWarning({
          type: payment.feeType ?? 'FLAT',
          value: payment.feeValue ?? payment.feeCents,
          feeCents: payment.feeCents,
          contactNumber: contact,
        })}
        qrImageUrl={config.data.qrImageUrl ?? null}
        contactNumber={contact}
        paymentNote={config.data.paymentNote ?? null}
      />
      {payment.customerTxnId ? (
        <SubmittedTxnId payment={payment} />
      ) : (
        <AddTxnIdCard paymentId={payment.id} contactNumber={contact} />
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { status } = useSession();
  const order = useOrderDetail(id);
  const feePayment = order.data?.payments[0];
  const feeState = order.data ? getFeeNoticeState(order.data.status, feePayment) : 'none';
  // Contact/QR/note are only needed while the fee is actionable.
  const config = usePaymentConfig({ enabled: feeState === 'pending' || feeState === 'rejected' });
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

      {feeState !== 'none' && feePayment ? (
        <FeeSection state={feeState} payment={feePayment} config={config} />
      ) : null}

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
            {feePayment && feePayment.feeCents > 0 && feePayment.feeStatus !== 'WAIVED' ? (
              <>
                <div className="flex justify-between">
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
