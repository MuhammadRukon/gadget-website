'use client';

import { useMemo, useState, type ComponentProps } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CodFeeType, PaymentMethod } from '@prisma/client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import {
  PAYMENT_NOTE_MAX,
  paymentSettingsInputSchema,
  type PaymentSettingsInput,
} from '@/contracts/payment-settings';
import { formatBDT } from '@/server/common/money';
import { computeCodConfirmationFee } from '@/server/checkout/cod-fee';
import {
  AdminImageUploader,
  type UploadedImage,
} from '@/modules/admin/catalog/components/admin-image-uploader';
import {
  useUpdatePaymentSettings,
  type AdminPaymentSettingsResponse,
} from '@/modules/admin/settings/hooks';

const DEFAULT_FLAT_CENTS = 10_000; // 100 BDT
const DEFAULT_PERCENT = 10;
const DEFAULT_SAMPLE_BDT = '498.40';

const METHODS: {
  method: PaymentMethod;
  field: 'codEnabled' | 'bkashEnabled' | 'sslcommerzEnabled' | 'bankTransferEnabled';
  label: string;
  hint: string;
}[] = [
  {
    method: PaymentMethod.COD,
    field: 'codEnabled',
    label: 'Cash on Delivery',
    hint: 'Customers pay in cash when the order arrives.',
  },
  {
    method: PaymentMethod.BANK_TRANSFER,
    field: 'bankTransferEnabled',
    label: 'Bank transfer',
    hint: 'Customers transfer manually and submit a reference; you verify it.',
  },
  {
    method: PaymentMethod.BKASH,
    field: 'bkashEnabled',
    label: 'bKash',
    hint: 'Online payment through the bKash gateway.',
  },
  {
    method: PaymentMethod.SSLCOMMERZ,
    field: 'sslcommerzEnabled',
    label: 'SSLCommerz',
    hint: 'Cards and mobile banking through the SSLCommerz hosted checkout.',
  },
];

function isValidFeeValue(type: CodFeeType, value: number): boolean {
  return type === CodFeeType.PERCENT
    ? Number.isInteger(value) && value >= 1 && value <= 100
    : Number.isInteger(value) && value >= 100 && value % 100 === 0;
}

function defaultFeeValue(type: CodFeeType): number {
  return type === CodFeeType.PERCENT ? DEFAULT_PERCENT : DEFAULT_FLAT_CENTS;
}

/**
 * Maps the stored row to form values. The contract validates `codFeeValue`
 * for its type even while the fee is off, and the seeded row stores 0, so an
 * invalid stored value is replaced by a valid default here.
 */
function toFormValues(settings: AdminPaymentSettingsResponse['settings']): PaymentSettingsInput {
  return {
    codEnabled: settings.codEnabled,
    bkashEnabled: settings.bkashEnabled,
    sslcommerzEnabled: settings.sslcommerzEnabled,
    bankTransferEnabled: settings.bankTransferEnabled,
    codFeeEnabled: settings.codFeeEnabled,
    codFeeType: settings.codFeeType,
    codFeeValue: isValidFeeValue(settings.codFeeType, settings.codFeeValue)
      ? settings.codFeeValue
      : defaultFeeValue(settings.codFeeType),
    qrImageUrl: settings.qrImageUrl,
    qrImagePublicId: settings.qrImagePublicId,
    contactNumber: settings.contactNumber,
    paymentNote: settings.paymentNote,
  };
}

/** Parses a BDT amount typed by an admin ("498.40") to integer cents, or null. */
function parseBdtToCents(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

/**
 * Fee amount input. FLAT edits whole BDT (stored as cents, x100); PERCENT
 * edits an integer 1-100. Keeps its own text so typing is never rewritten
 * under the cursor; the form always holds the contract's units.
 */
function FeeValueInput({
  type,
  value,
  onChange,
  ...inputProps
}: {
  type: CodFeeType;
  value: number;
  onChange: (next: number) => void;
} & Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'>) {
  const fromForm = type === CodFeeType.PERCENT ? value : value / 100;
  const [text, setText] = useState(String(fromForm));
  const [lastSynced, setLastSynced] = useState({ type, value });

  // Re-sync only when the form value changed from outside (type switch, reset).
  if (lastSynced.type !== type || lastSynced.value !== value) {
    setLastSynced({ type, value });
    setText(String(fromForm));
  }

  return (
    <Input
      {...inputProps}
      inputMode={type === CodFeeType.PERCENT ? 'numeric' : 'decimal'}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = Number(raw);
        // Unparseable input becomes 0, which the contract rejects with its
        // own message ("Flat fee must be ..." / "Percentage must be ...").
        const next =
          raw.trim() === '' || !Number.isFinite(n)
            ? 0
            : type === CodFeeType.PERCENT
              ? n
              : Math.round(n * 100);
        setLastSynced({ type, value: next });
        onChange(next);
      }}
    />
  );
}

interface PaymentSettingsFormProps {
  data: AdminPaymentSettingsResponse;
}

export function PaymentSettingsForm({ data }: PaymentSettingsFormProps) {
  const update = useUpdatePaymentSettings();
  const { gatewayConfigured } = data;

  const form = useForm<PaymentSettingsInput>({
    resolver: zodResolver(paymentSettingsInputSchema),
    defaultValues: toFormValues(data.settings),
  });

  const values = useWatch({ control: form.control });
  const [sampleBdt, setSampleBdt] = useState(DEFAULT_SAMPLE_BDT);

  const anyMethodOn = METHODS.some((m) => values[m.field] && gatewayConfigured[m.method]);

  const preview = useMemo(() => {
    if (!values.codFeeEnabled || values.codFeeType === undefined) return null;
    const totalCents = parseBdtToCents(sampleBdt);
    if (totalCents === null || values.codFeeValue === undefined) return null;
    try {
      const fee = computeCodConfirmationFee({
        type: values.codFeeType,
        value: values.codFeeValue,
        totalCents,
      });
      return { totalCents, fee };
    } catch {
      return null;
    }
  }, [values.codFeeEnabled, values.codFeeType, values.codFeeValue, sampleBdt]);

  async function onSubmit(input: PaymentSettingsInput) {
    try {
      const res = await update.mutateAsync({
        ...input,
        contactNumber: input.contactNumber?.trim() ? input.contactNumber.trim() : null,
        paymentNote: input.paymentNote?.trim() ? input.paymentNote : null,
        qrImageUrl: input.qrImageUrl ?? null,
        qrImagePublicId: input.qrImagePublicId ?? null,
      });
      form.reset(toFormValues(res.settings));
    } catch {
      // Toast handled inside the mutation.
    }
  }

  const qrValue: UploadedImage[] =
    values.qrImageUrl && values.qrImagePublicId
      ? [{ url: values.qrImageUrl, publicId: values.qrImagePublicId, alt: 'Payment QR code' }]
      : [];

  const codOn = !!values.codEnabled;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>
              Choose which methods customers can use at checkout. Gateways need credentials
              configured on the server before they can be turned on.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {METHODS.map(({ method, field, label, hint }) => {
              const configured = gatewayConfigured[method];
              return (
                <FormField
                  key={method}
                  control={form.control}
                  name={field}
                  render={({ field: f }) => (
                    <FormItem className="flex items-center justify-between gap-4 space-y-0 rounded-lg border p-3">
                      <div className="space-y-1">
                        <FormLabel className="flex flex-wrap items-center gap-2">
                          {label}
                          {!configured ? (
                            <Badge variant="outline" className="text-amber-700 dark:text-amber-300">
                              credentials missing
                            </Badge>
                          ) : null}
                        </FormLabel>
                        <FormDescription>{hint}</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={!!f.value}
                          // A gateway without credentials can be switched off but never on.
                          disabled={!configured && !f.value}
                          onCheckedChange={(next) => {
                            f.onChange(next);
                            if (field === 'codEnabled' && !next) {
                              form.setValue('codFeeEnabled', false, { shouldDirty: true });
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              );
            })}
            {!anyMethodOn ? (
              <Alert variant="destructive">
                <AlertTitle>No payment method enabled</AlertTitle>
                <AlertDescription>
                  Turn on at least one available method, otherwise customers cannot check out.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash on Delivery confirmation fee</CardTitle>
            <CardDescription>
              When on, COD orders stay pending until you verify an advance fee that the customer
              pays outside the site. The fee is credited against the order total.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="codFeeEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 space-y-0 rounded-lg border p-3">
                  <div className="space-y-1">
                    <FormLabel>Require a confirmation fee</FormLabel>
                    <FormDescription>
                      {codOn
                        ? 'New COD orders wait for your verification.'
                        : 'Enable Cash on Delivery first.'}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={!!field.value && codOn}
                      disabled={!codOn}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="codFeeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(next) => {
                        const type = next as CodFeeType;
                        field.onChange(type);
                        if (!isValidFeeValue(type, form.getValues('codFeeValue'))) {
                          form.setValue('codFeeValue', defaultFeeValue(type), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={CodFeeType.FLAT}>Flat amount (BDT)</SelectItem>
                        <SelectItem value={CodFeeType.PERCENT}>Percentage of total</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="codFeeValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {values.codFeeType === CodFeeType.PERCENT ? 'Fee (%)' : 'Fee (BDT)'}
                    </FormLabel>
                    <FormControl>
                      <FeeValueInput
                        type={values.codFeeType ?? CodFeeType.FLAT}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      {values.codFeeType === CodFeeType.PERCENT
                        ? 'Whole number 1-100. Rounded up to the next Tk 10 and capped at the order total.'
                        : 'Whole BDT, at least 1. Capped at the order total.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="fee-sample">Preview on an order of Tk</Label>
                <Input
                  id="fee-sample"
                  className="w-28"
                  inputMode="decimal"
                  value={sampleBdt}
                  onChange={(e) => setSampleBdt(e.target.value)}
                />
              </div>
              <p aria-live="polite" data-testid="fee-preview">
                {!values.codFeeEnabled
                  ? 'Turn the fee on to see a preview.'
                  : preview
                    ? `On an order of ${formatBDT(preview.totalCents)} → fee ${formatBDT(preview.fee)}, due on delivery ${formatBDT(preview.totalCents - preview.fee)}`
                    : 'Enter a valid order amount and fee to see a preview.'}
              </p>
            </div>

            <FormField
              control={form.control}
              name="contactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="01XXXXXXXXX"
                      value={field.value ?? ''}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    Shown to customers so they know where to pay or whom to contact. Required when
                    the fee is on.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment note</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      maxLength={PAYMENT_NOTE_MAX}
                      placeholder="e.g. Send the fee via bKash personal, then add the transaction ID."
                      value={field.value ?? ''}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {(field.value ?? '').length}/{PAYMENT_NOTE_MAX}. Shown as plain text.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="qrImageUrl"
              render={() => (
                <FormItem>
                  <AdminImageUploader
                    label="Payment QR code"
                    single
                    folder="settings"
                    deferDelete
                    value={qrValue}
                    onChange={(next) => {
                      const img = next[0];
                      form.setValue('qrImageUrl', img?.url ?? null, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      form.setValue('qrImagePublicId', img?.publicId ?? null, {
                        shouldDirty: true,
                      });
                    }}
                  />
                  <FormDescription>
                    The previous QR is removed from storage when you save.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!form.formState.isDirty || update.isPending}
            onClick={() => form.reset(toFormValues(data.settings))}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            disabled={!form.formState.isDirty || update.isPending || !anyMethodOn}
          >
            {update.isPending ? 'Saving...' : 'Save settings'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
