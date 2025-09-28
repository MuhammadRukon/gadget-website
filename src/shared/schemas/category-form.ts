import { z } from 'zod';
import { Status } from '@prisma/client';

export const defaultCategoryFormValues = {
  name: '',
  slug: '',
  status: Status.ACTIVE,
};

export const categoryFormSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50),
  status: z.enum(Status),
});
