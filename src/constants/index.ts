import { Status } from '@prisma/client';
import { Availability } from '@/enums';

export const StatusOptions = [
  { value: Status.ACTIVE, label: 'Active' },
  { value: Status.INACTIVE, label: 'Inactive' },
  { value: Status.ARCHIVED, label: 'Archived' },
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
