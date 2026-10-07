'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CodFeeStatus, PaymentMethod } from '@prisma/client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader } from '@/app/common/loader/loader';
import { formatBDT } from '@/server/common/money';

import { FeeStatusBadge } from '@/modules/admin/payments/components/fee-status-badge';
import {
  useAdminPendingPayments,
  useVerifyCodFee,
  useVerifyPayment,
} from '@/modules/admin/payments/hooks';

type PendingAction =
  | { kind: 'payment'; id: string; orderNumber: string; outcome: 'SUCCEEDED' | 'FAILED' }
  | { kind: 'fee'; id: string; orderNumber: string; outcome: 'VERIFIED' | 'REJECTED' };

function describeAction(a: PendingAction): {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
} {
  if (a.kind === 'fee') {
    return a.outcome === 'VERIFIED'
      ? {
          title: 'Verify the confirmation fee?',
          description: `The fee for order ${a.orderNumber} will be marked verified and the order confirmed.`,
          confirmLabel: 'Verify fee',
          destructive: false,
        }
      : {
          title: 'Reject the confirmation fee?',
          description: `The fee for order ${a.orderNumber} will be rejected. The order stays pending and the customer is told the fee could not be verified. This cannot be undone.`,
          confirmLabel: 'Reject fee',
          destructive: true,
        };
  }
  return a.outcome === 'SUCCEEDED'
    ? {
        title: 'Verify this payment?',
        description: `Order ${a.orderNumber} will be marked as paid and confirmed.`,
        confirmLabel: 'Verify',
        destructive: false,
      }
    : {
        title: 'Reject this payment?',
        description: `The payment for order ${a.orderNumber} will be marked as failed.`,
        confirmLabel: 'Reject',
        destructive: true,
      };
}

export default function AdminPaymentsPage() {
  const pending = useAdminPendingPayments();
  const verify = useVerifyPayment();
  const verifyFee = useVerifyCodFee();
  const [actingId, setActingId] = useState<string | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const copy = action ? describeAction(action) : null;

  function runAction(a: PendingAction) {
    setActingId(a.id);
    if (a.kind === 'fee') {
      verifyFee.mutate({ id: a.id, outcome: a.outcome });
    } else {
      verify.mutate({ id: a.id, outcome: a.outcome });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Verify cash on delivery and bank-transfer payments awaiting human review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Awaiting verification</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader />
            </div>
          ) : (pending.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments need attention right now.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Txn ID</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Fee status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pending.data ?? []).map((p) => {
                  const busy = actingId === p.id && (verify.isPending || verifyFee.isPending);
                  const isCod = p.method === PaymentMethod.COD;
                  const feePending = isCod && p.feeStatus === CodFeeStatus.PENDING;
                  const feeRejected = isCod && p.feeStatus === CodFeeStatus.REJECTED;
                  const hasFee = p.feeStatus !== CodFeeStatus.NONE;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.order.orderNumber}</TableCell>
                      <TableCell>
                        <div>{p.order.shipRecipient}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.order.user?.email ?? p.order.shipPhone}
                        </div>
                      </TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell className="font-mono text-xs">{p.bankRef ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs break-all">
                        {p.customerTxnId ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">{formatBDT(p.amountCents)}</TableCell>
                      <TableCell className="text-right">
                        {hasFee ? formatBDT(p.feeCents) : '—'}
                      </TableCell>
                      <TableCell>
                        {hasFee ? <FeeStatusBadge status={p.feeStatus} /> : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {feePending ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                setAction({
                                  kind: 'fee',
                                  id: p.id,
                                  orderNumber: p.order.orderNumber,
                                  outcome: 'VERIFIED',
                                })
                              }
                            >
                              Verify fee
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                setAction({
                                  kind: 'fee',
                                  id: p.id,
                                  orderNumber: p.order.orderNumber,
                                  outcome: 'REJECTED',
                                })
                              }
                            >
                              Reject fee
                            </Button>
                          </>
                        ) : feeRejected ? (
                          // A rejected fee cannot be re-decided; waive or cancel from the order.
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/orders/${p.order.id}`}>Open order</Link>
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                setAction({
                                  kind: 'payment',
                                  id: p.id,
                                  orderNumber: p.order.orderNumber,
                                  outcome: 'SUCCEEDED',
                                })
                              }
                            >
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                setAction({
                                  kind: 'payment',
                                  id: p.id,
                                  orderNumber: p.order.orderNumber,
                                  outcome: 'FAILED',
                                })
                              }
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={copy?.title ?? ''}
        description={copy?.description ?? ''}
        confirmLabel={copy?.confirmLabel ?? 'Confirm'}
        destructive={copy?.destructive}
        onConfirm={() => {
          if (action) runAction(action);
        }}
      />
    </div>
  );
}
