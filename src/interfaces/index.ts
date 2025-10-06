import { ReactNode } from 'react';
import { ProductStatus, Brand, Category, Product } from '@prisma/client';
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

//TODO:Remove this IBrand interface
export interface IBrand {
  id: string;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
  isPopular: boolean;
}

//TODO:Remove this ICategory interface
export interface ICategory {
  id: string;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
  isPopular: boolean;
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
  //TODO: Remove this IBrand interface and import from @prisma/client
  brands: IBrand[];
}

export interface IHeaderButton {
  href: string;
  title: string;
  icon?: string | ReactNode;
}

export type IBrandCreateOrUpdateEntity = Omit<
  Brand,
  'id' | 'createdAt' | 'updatedAt' | 'isPopular'
>;

export type ICategoryCreateOrUpdateEntity = Omit<
  Category,
  'id' | 'createdAt' | 'updatedAt' | 'isPopular'
>;

export type IProductCreateOrUpdateEntity = Omit<
  Product,
  'id' | 'createdAt' | 'updatedAt' | 'isPopular'
>;