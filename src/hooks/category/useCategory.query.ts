import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { CategoryAction } from '@/actions/category.action';
import { useCategoryStore } from '@/stores/useCategory.store';
import { Category } from '@prisma/client';
import { categoryQueryKey } from '@/constants/queryKeys';

export const useCategoryQuery = () => {
  const getCategories = useQuery({
    queryKey: categoryQueryKey,
    // enabled: false,
    queryFn: async () => {
      const res = await CategoryAction.getAll();

      if (!res.ok) throw new Error('Failed to fetch categories');

      const data: Category[] = await res.json();

      return data;
    },
  });

  useEffect(() => {
    if (getCategories.isSuccess && getCategories.data) {
      useCategoryStore.setState({ categories: getCategories.data });
    }
    if (getCategories.isError && getCategories.error) {
      console.error('Error fetching categories', getCategories.error.message);
    }
  }, [getCategories.isSuccess, getCategories.data, getCategories.isError, getCategories.error]);

  return {
    getCategories,
  };
};
