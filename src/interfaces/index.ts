import { ReactNode } from 'react';
import { Status, ProductStatus, Brand } from '@prisma/client';
export type Theme = 'light' | 'dark';

export interface IBaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBaseNamedEntity extends IBaseEntity {
  name: string;
  isPopular: boolean;
  slug: string;
}

//Remove this IBrand interface
export interface IBrand {
  id: string;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
  isPopular: boolean;
}

export interface ICategory extends IBaseNamedEntity {
  status: Status;
}

export interface IProduct extends IBaseNamedEntity {
  status: ProductStatus;
  description?: string;
  priceCents: number;
  discountCents: number;
  discountPercentage: number;
  imageUrl?: string;
  stock: number;
}

export interface IMenu extends ICategory {
  brands: Brand[];
}

export interface IHeaderButton {
  href: string;
  title: string;
  icon?: string | ReactNode;
}

export type IBrandCreateEntity = Omit<Brand, 'id' | 'createdAt' | 'updatedAt' | 'isPopular'>;
