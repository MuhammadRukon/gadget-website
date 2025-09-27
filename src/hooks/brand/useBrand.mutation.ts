import { useMutation, useQueryClient } from '@tanstack/react-query';

import { BrandAction } from '@/actions/brand.action';

import { IBrandCreateOrUpdateEntity } from '@/interfaces';
import { brandQueryKey } from '@/constants/queryKeys';
import { toast } from 'sonner';

export const useBrandMutation = () => {
  const queryClient = useQueryClient();

  function invalidateQuery() {
    queryClient.invalidateQueries({ queryKey: brandQueryKey });
  }

  const createBrand = useMutation({
    mutationFn: ({ brand }: { brand: IBrandCreateOrUpdateEntity }) => BrandAction.create(brand),
    // onMutate: () => {}, TODO: implement optimistic update
    onSuccess: () => toast.success('Brand created successfully'),
    onError: () => toast.error('Error creating brand'),
    onSettled: invalidateQuery,
  });

  const updateBrand = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: IBrandCreateOrUpdateEntity }) => {
      return BrandAction.update(id, payload);
    },
    onSuccess: () => toast.success('Brand updated successfully'),
    onError: () => toast.error('Error updating brand'),
    onSettled: invalidateQuery,
  });

  const removeBrand = useMutation({
    mutationFn: (id: string) => BrandAction.remove(id),
    onSuccess: () => toast.success('Brand removed successfully'),
    onError: () => toast.error('Error removing brand'),
    onSettled: invalidateQuery,
  });

  return {
    createBrand,
    updateBrand,
    removeBrand,
  };
};
