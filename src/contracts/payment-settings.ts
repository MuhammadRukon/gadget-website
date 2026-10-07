import { CodFeeType, PaymentMethod } from '@prisma/client';
import { z } from 'zod';

/**
 * Admin-configured payment methods + COD confirmation fee.
 *
 * `codFeeValue` units depend on `codFeeType`:
 *  - FLAT    -> integer cents (BDT paisa), a multiple of 100, at least 100
 *  - PERCENT -> integer 1..100 (percent of the order grand total)
 */

const BD_MOBILE = /^(\+?88)?01[3-9]\d{8}$/;
const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/';

export const PAYMENT_NOTE_MAX = 500;

export const codFeeRuleSchema = z.object({
  type: z.enum(CodFeeType),
  value: z.number().int(),
});
export type CodFeeRule = z.infer<typeof codFeeRuleSchema>;

export const paymentSettingsInputSchema = z
  .object({
    // No defaults on purpose: an omitted flag must be a validation error,
    // never a silent "off" that disables a method.
    codEnabled: z.boolean(),
    bkashEnabled: z.boolean(),
    sslcommerzEnabled: z.boolean(),
    bankTransferEnabled: z.boolean(),
    codFeeEnabled: z.boolean(),
    codFeeType: z.enum(CodFeeType),
    codFeeValue: z.number().int(),
    qrImageUrl: z
      .string()
      .max(2048)
      .refine((v) => v.startsWith(CLOUDINARY_PREFIX), {
        message: 'QR image must be hosted on Cloudinary',
      })
      .nullable()
      .optional(),
    qrImagePublicId: z.string().max(512).nullable().optional(),
    contactNumber: z
      .string()
      .trim()
      .regex(BD_MOBILE, 'Enter a valid Bangladeshi mobile number')
      .nullable()
      .optional(),
    paymentNote: z.string().max(PAYMENT_NOTE_MAX).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.codFeeType === CodFeeType.PERCENT) {
      if (v.codFeeValue < 1 || v.codFeeValue > 100) {
        ctx.addIssue({
          code: 'custom',
          path: ['codFeeValue'],
          message: 'Percentage must be a whole number from 1 to 100',
        });
      }
    } else if (v.codFeeValue < 100 || v.codFeeValue % 100 !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['codFeeValue'],
        message: 'Flat fee must be a whole BDT amount of at least 1 BDT',
      });
    }

    if (v.codFeeEnabled && !v.contactNumber) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactNumber'],
        message: 'Contact number is required when the confirmation fee is on',
      });
    }
  });
export type PaymentSettingsInput = z.infer<typeof paymentSettingsInputSchema>;

/** Shape returned to the checkout/order UI (never includes secrets). */
export interface PublicPaymentConfig {
  methods: PaymentMethod[];
  cod: {
    feeEnabled: boolean;
    type: CodFeeType;
    value: number;
  };
  qrImageUrl: string | null;
  contactNumber: string | null;
  paymentNote: string | null;
}
