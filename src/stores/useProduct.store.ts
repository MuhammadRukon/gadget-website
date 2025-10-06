import { Product } from '@prisma/client';
import { create } from 'zustand';

interface State {
  products: Product[];
  isLoading: boolean;
  editProduct: Product | null;
}

interface Actions {
  setProducts: (products: Product[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setEditProduct: (editProduct: Product | null) => void;
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
