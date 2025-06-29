import { ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export interface ICategory {
  id: string;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
  isPopular: boolean;
}

export interface IBrand {
  id: string;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
  isPopular: boolean;
}

export interface IMenu extends ICategory {
  brands: IBrand[];
}

export interface IHeaderButton {
  href: string;
  title: string;
  icon?: string | ReactNode;
}
