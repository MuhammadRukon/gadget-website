'use client';

import { useState } from 'react';

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

import { useAdminPendingPayments, useVerifyPayment } from '@/modules/admin/payments/hooks';

export default function AdminPaymentsPage() {
  const pending = useAdminPendingPayments();
  const verify = useVerifyPayment();
  const [actingId, setActingId] = useState<string | null>(null);

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
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pending.data ?? []).map((p) => {
                  const busy = actingId === p.id && verify.isPending;
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
                      <TableCell className="text-right">{formatBDT(p.amountCents)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setActingId(p.id);
                            verify.mutate({ id: p.id, outcome: 'SUCCEEDED' });
                          }}
                        >
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setActingId(p.id);
                            verify.mutate({ id: p.id, outcome: 'FAILED' });
                          }}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
