import { Category } from '@prisma/client';
import { create } from 'zustand';

interface State {
  categories: Category[];
  isLoading: boolean;
  editCategory: Category | null;
}

interface Actions {
  setCategories: (categories: Category[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setEditCategory: (editCategory: Category | null) => void;
  reset: () => void;
}

const initialState: State = {
  categories: [],
  isLoading: false,
  editCategory: null,
};

export const useCategoryStore = create<State & Actions>((set) => ({
  ...initialState,

  setCategories: (categories) => set({ categories }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setEditCategory: (editCategory) => set({ editCategory }),
  reset: () => set(initialState),
}));
