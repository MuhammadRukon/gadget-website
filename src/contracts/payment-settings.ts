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
const CLOUDINARY_HOST = 'res.cloudinary.com';
/** Characters our uploader produces in a public id (path segments joined by '/'). */
const PUBLIC_ID = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;

/**
 * Structural parse of a Cloudinary plain-upload delivery URL:
 * `https://res.cloudinary.com/<cloud>/image/upload/[v123/]<publicId>[.ext]`.
 * Rejects other schemes, hosts (incl. userinfo/port tricks), resource types
 * and delivery types (notably `fetch`, which proxies arbitrary remote URLs).
 * Cloud-name pinning needs server env, so it lives in the settings service.
 */
export function parseCloudinaryUploadUrl(
  value: string,
): { cloudName: string; publicId: string } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== CLOUDINARY_HOST) return null;
  if (url.port || url.username || url.password || url.search || url.hash) return null;

  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const m = path.match(/^\/([^/]+)\/image\/upload\/(?:v\d+\/)?(.+)$/);
  if (!m) return null;
  // Drop the file extension from the last segment to get the public id.
  return { cloudName: m[1], publicId: m[2].replace(/\.[A-Za-z0-9]+$/, '') };
}

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
      .refine((v) => parseCloudinaryUploadUrl(v) !== null, {
        message: 'QR image must be an uploaded Cloudinary image',
      })
      .nullable()
      .optional(),
    qrImagePublicId: z
      .string()
      .max(512)
      .regex(PUBLIC_ID, 'Invalid image id')
      .nullable()
      .optional(),
    contactNumber: z
      .string()
      .trim()
      .regex(BD_MOBILE, 'Enter a valid Bangladeshi mobile number')
      .nullable()
      .optional(),
    paymentNote: z.string().max(PAYMENT_NOTE_MAX).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    // The QR url and its Cloudinary public id are set together and must agree
    // (the public id is what gets deleted when the QR is replaced).
    if (v.qrImageUrl && !v.qrImagePublicId) {
      ctx.addIssue({
        code: 'custom',
        path: ['qrImagePublicId'],
        message: 'Image id is required with the QR image',
      });
    } else if (!v.qrImageUrl && v.qrImagePublicId) {
      ctx.addIssue({
        code: 'custom',
        path: ['qrImageUrl'],
        message: 'QR image is required with the image id',
      });
    } else if (v.qrImageUrl && v.qrImagePublicId) {
      const parsed = parseCloudinaryUploadUrl(v.qrImageUrl);
      if (parsed && parsed.publicId !== v.qrImagePublicId) {
        ctx.addIssue({
          code: 'custom',
          path: ['qrImagePublicId'],
          message: 'Image id does not match the QR image URL',
        });
      }
    }

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

    if (v.codFeeEnabled && !v.codEnabled) {
      ctx.addIssue({
        code: 'custom',
        path: ['codFeeEnabled'],
        message: 'The confirmation fee requires Cash on Delivery to be enabled',
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
