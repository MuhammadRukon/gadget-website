import { create } from 'zustand';
import { Brand } from '@prisma/client';

interface State {
  brands: Brand[];
  isLoading: boolean;
  editBrand: Brand | null;
}

interface Actions {
  setBrands: (brands: Brand[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setEditBrand: (editBrand: Brand | null) => void;
  reset: () => void;
}

const initialState: State = {
  brands: [],
  isLoading: false,
  editBrand: null,
};

export const useBrandStore = create<State & Actions>((set) => ({
  ...initialState,

  setBrands: (brands) => set({ brands }),
  setEditBrand: (editBrand) => set({ editBrand }),
  setIsLoading: (isLoading: boolean) => set({ isLoading }),
  reset: () => set(initialState),
}));
