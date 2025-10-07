import { Product, Category } from '@prisma/client';
import { create } from 'zustand';

type ProductWithCategories = Product & {
  productCategories: {
    category: Category;
  }[];
};

interface State {
  products: ProductWithCategories[];
  isLoading: boolean;
  editProduct: ProductWithCategories | null;
}

interface Actions {
  setProducts: (products: ProductWithCategories[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setEditProduct: (editProduct: ProductWithCategories | null) => void;
  reset: () => void;
}

const initialState: State = {
  products: [],
  isLoading: false,
  editProduct: null,
};

export const useProductStore = create<State & Actions>((set) => ({
  ...initialState,

  setProducts: (products) => set({ products }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setEditProduct: (editProduct) => set({ editProduct }),
  reset: () => set(initialState),
}));
