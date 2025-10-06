import { ProductStatus, Status } from '@prisma/client';
import { Availability } from '@/enums';

export const StatusOptions = [
  { value: Status.ACTIVE, label: 'Active' },
  { value: Status.INACTIVE, label: 'Inactive' },
  { value: Status.ARCHIVED, label: 'Archived' },
];

export const ProductStatusOptions = [
  { value: ProductStatus.IN_STOCK, label: 'In Stock' },
  { value: ProductStatus.OUT_OF_STOCK, label: 'Out of Stock' },
  { value: ProductStatus.PRE_ORDER, label: 'Pre Order' },
  { value: ProductStatus.DISCONTINUED, label: 'Discontinued' },
  { value: ProductStatus.INACTIVE, label: 'Inactive' },
  { value: ProductStatus.ARCHIVED, label: 'Archived' },
];

export const availabilityOptions = [
  { id: Availability.IN_STOCK, label: Availability.IN_STOCK },
  { id: Availability.UPCOMING, label: Availability.UPCOMING },
  { id: Availability.PRE_ORDER, label: Availability.PRE_ORDER },
];

export const IconOptions = [
  { value: '/earphone.svg', label: 'Earphone' },
  { value: '/smartwatch.svg', label: 'Smartwatch' },
];
