import { z } from 'zod';
import { Status } from '@prisma/client';

export const defaultBrandFormValues = { name: '', slug: '', status: Status.ACTIVE, imageUrl: '' };

export const brandFormSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50),
  status: z.enum(Status),
  imageUrl: z.string().min(1), // NOTE: this is required as we are using typical Input component.
});
