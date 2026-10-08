'use client';

import { useState } from 'react';
import type { Payment } from '@prisma/client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useVerifyCodFee } from '@/modules/admin/payments/hooks';

interface RejectFeeDialogProps {
  paymentId: Payment['id'];
  /** Whether the "Reject fee" trigger shows (the dialog stays mounted regardless). */
  canReject: boolean;
  /** Extra disable for the trigger (the panel's other fee mutation is in flight). */
  disabled?: boolean;
}

/**
 * Trigger button plus the reject-fee dialog (optional customer-visible note)
 * for the admin COD fee panel. Owns the note state and the REJECTED mutation.
 */
export function RejectFeeDialog({ paymentId, canReject, disabled = false }: RejectFeeDialogProps) {
  const verifyFee = useVerifyCodFee();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  return (
    <>
      {canReject ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={disabled || verifyFee.isPending}
          onClick={() => {
            setRejectNote('');
            setRejectOpen(true);
          }}
        >
          Reject fee
        </Button>
      ) : null}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyFee.mutate(
                { id: paymentId, outcome: 'REJECTED', note: rejectNote },
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
    </>
  );
}
