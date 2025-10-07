import { z } from 'zod';
import { ProductStatus } from '@prisma/client';

export const defaultProductFormValues = {
  name: '',
  slug: '',
  isPopular: false,
  description: '',
  priceCents: 0,
  discountCents: 0,
  discountPercentage: 0,
  imageUrls: [],
  stock: 0,
  status: ProductStatus.PRE_ORDER,
  brandId: '',
  productCategories: [], //NOTE: to establish many to many relation with categories
};

export const productFormSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50),
  isPopular: z.boolean(),
  description: z.string().min(2),
  priceCents: z.number().min(0),
  discountCents: z.number().min(0),
  discountPercentage: z.number().min(0),
  imageUrls: z.array(z.string()).min(1),
  stock: z.number().min(1),
  status: z.enum(ProductStatus),
  brandId: z.string().min(2),
  productCategories: z.array(z.string()).min(1), //NOTE: to establish many to many relation with categories
});
