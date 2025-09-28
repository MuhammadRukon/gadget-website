import { useMutation, useQueryClient } from '@tanstack/react-query';

import { categoryQueryKey } from '@/constants/queryKeys';
import { toast } from 'sonner';
import { ICategoryCreateOrUpdateEntity } from '@/interfaces';
import { CategoryAction } from '@/actions/category.action';

export const useCategoryMutation = () => {
  const queryClient = useQueryClient();

  function invalidateQuery() {
    queryClient.invalidateQueries({ queryKey: categoryQueryKey });
  }

  const createCategory = useMutation({
    mutationFn: ({ category }: { category: ICategoryCreateOrUpdateEntity }) =>
      CategoryAction.create(category),
    // onMutate: () => {}, TODO: implement optimistic update
    onSuccess: () => toast.success('Category created successfully'),
    onError: () => toast.error('Error creating category'),
    onSettled: invalidateQuery,
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ICategoryCreateOrUpdateEntity }) => {
      return CategoryAction.update(id, payload);
    },
    onSuccess: () => toast.success('Category updated successfully'),
    onError: () => toast.error('Error updating category'),
    onSettled: invalidateQuery,
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => CategoryAction.remove(id),
    onSuccess: () => toast.success('Category removed successfully'),
    onError: () => toast.error('Error removing category'),
    onSettled: invalidateQuery,
  });

  return {
    createCategory,
    updateCategory,
    removeCategory,
  };
};
