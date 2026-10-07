'use client';

import { useState, type FormEvent } from 'react';
import { CodFeeStatus, OrderStatus, type Order, type Payment } from '@prisma/client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TXN_ID_MAX, TXN_ID_MIN, txnIdSchema } from '@/contracts/payments';
import { dueOnDeliveryCents } from '@/lib/cod-fee/compute';
import { describeCodFeeRule } from '@/lib/cod-fee/copy';
import { canFee } from '@/lib/cod-fee/policy';
import { formatBDT } from '@/server/common/money';
import { DuplicateTxnDialog } from '@/modules/admin/payments/components/duplicate-txn-dialog';
import { FeeStatusBadge } from '@/modules/admin/payments/components/fee-status-badge';
import {
  getDuplicateTxnInfo,
  useAdminSetTxnId,
  useVerifyCodFee,
  type DuplicateTxnInfo,
} from '@/modules/admin/payments/hooks';

interface CodFeePanelProps {
  order: Pick<Order, 'status' | 'totalCents' | 'orderNumber'>;
  payment: Payment;
}

/** True when this payment carries a confirmation fee worth showing a panel for. */
export function hasCodFee(payment: Payment | undefined): payment is Payment {
  return !!payment && payment.feeStatus !== CodFeeStatus.NONE;
}

/**
 * Admin order-detail panel for the COD confirmation fee: rule, amounts,
 * status, the customer's transaction id, and the verify / reject / edit-id
 * actions. While the order is PENDING the fee can be verified from PENDING or
 * REJECTED (a customer may pay after being rejected), but rejected only from
 * PENDING; the id can also be edited and the order waived or cancelled.
 */
export function CodFeePanel({ order, payment }: CodFeePanelProps) {
  const verifyFee = useVerifyCodFee();
  const setTxnId = useAdminSetTxnId();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnValue, setTxnValue] = useState('');
  const [txnError, setTxnError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateTxnInfo | null>(null);

  const orderPending = order.status === OrderStatus.PENDING;
  // Verifying and editing the txn id are allowed in exactly the same states.
  const canVerify = orderPending && canFee('verify', payment.feeStatus);
  const canEditTxn = canVerify;
  const canReject = orderPending && canFee('reject', payment.feeStatus);

  const rule =
    payment.feeType && payment.feeValue !== null
      ? describeCodFeeRule({ type: payment.feeType, value: payment.feeValue }, payment.feeCents)
      : null;

  function openTxnDialog() {
    setTxnValue(payment.customerTxnId ?? '');
    setTxnError(null);
    setTxnOpen(true);
  }

  function submitTxn(e: FormEvent) {
    e.preventDefault();
    const parsed = txnIdSchema.safeParse(txnValue);
    if (!parsed.success) {
      setTxnError(parsed.error.issues[0]?.message ?? 'Enter a valid transaction ID');
      return;
    }
    setTxnError(null);
    setTxnId.mutate(
      { id: payment.id, txnId: parsed.data },
      {
        onSuccess: () => setTxnOpen(false),
        onError: (err) => {
          const dup = getDuplicateTxnInfo(err);
          if (dup) {
            setTxnOpen(false);
            setDuplicate(dup);
          }
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>COD confirmation fee</CardTitle>
        <FeeStatusBadge status={payment.feeStatus} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Rule</dt>
            <dd>{rule ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fee (advance)</dt>
            <dd className="font-medium">{formatBDT(payment.feeCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Due on delivery</dt>
            <dd className="font-medium">{formatBDT(
                dueOnDeliveryCents({
                  totalCents: order.totalCents,
                  feeCents: payment.feeCents,
                  feeStatus: payment.feeStatus,
                }),
              )}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Customer transaction ID</dt>
            <dd className="font-mono break-all">{payment.customerTxnId ?? '—'}</dd>
            {payment.txnSubmittedAt ? (
              <dd className="text-xs text-muted-foreground">
                Submitted {new Date(payment.txnSubmittedAt).toLocaleString()}
              </dd>
            ) : null}
          </div>
          {payment.feeVerifiedAt ? (
            <div>
              <dt className="text-xs text-muted-foreground">Verified</dt>
              <dd>{new Date(payment.feeVerifiedAt).toLocaleString()}</dd>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-2 pt-1">
          {canEditTxn ? (
            <Button type="button" size="sm" variant="outline" onClick={openTxnDialog}>
              {payment.customerTxnId ? 'Edit transaction ID' : 'Add transaction ID'}
            </Button>
          ) : null}
          {canVerify ? (
            <Button
              type="button"
              size="sm"
              disabled={verifyFee.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Fee received — confirm order
            </Button>
          ) : null}
          {canReject ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={verifyFee.isPending}
              onClick={() => {
                setRejectNote('');
                setRejectOpen(true);
              }}
            >
              Reject fee
            </Button>
          ) : null}
        </div>
        {payment.feeStatus === CodFeeStatus.REJECTED && orderPending ? (
          <p className="text-xs text-muted-foreground">
            The fee was rejected. You can still correct the transaction ID, confirm that the fee
            was received, confirm the order without it (waives the fee), or cancel it.
          </p>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm the fee was received?"
        description={`Order ${order.orderNumber} will be confirmed and the fee marked as verified.`}
        confirmLabel="Fee received — confirm order"
        onConfirm={() => verifyFee.mutate({ id: payment.id, outcome: 'VERIFIED' })}
      />

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyFee.mutate(
                { id: payment.id, outcome: 'REJECTED', note: rejectNote },
                { onSuccess: () => setRejectOpen(false) },
              );
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>Reject the confirmation fee?</DialogTitle>
              <DialogDescription>
                The order stays pending and the customer is told the fee could not be verified. You
                can still verify the fee later if it arrives.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reject-note">Note (optional)</Label>
              <Textarea
                id="reject-note"
                rows={3}
                maxLength={300}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This note is visible to the customer on their order timeline.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={verifyFee.isPending}>
                Reject fee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
        <DialogContent>
          <form onSubmit={submitTxn} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>
                {payment.customerTxnId ? 'Edit transaction ID' : 'Add transaction ID'}
              </DialogTitle>
              <DialogDescription>
                {TXN_ID_MIN} to {TXN_ID_MAX} letters and numbers. It is stored in upper case and
                must not be used on another order.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="admin-txn-id">Transaction ID</Label>
              <Input
                id="admin-txn-id"
                autoComplete="off"
                value={txnValue}
                aria-invalid={!!txnError}
                aria-describedby={txnError ? 'admin-txn-id-error' : undefined}
                onChange={(e) => setTxnValue(e.target.value)}
              />
              {txnError ? (
                <p id="admin-txn-id-error" className="text-sm text-destructive">
                  {txnError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTxnOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={setTxnId.isPending}>
                {setTxnId.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DuplicateTxnDialog duplicate={duplicate} onClose={() => setDuplicate(null)} />
    </Card>
  );
}
