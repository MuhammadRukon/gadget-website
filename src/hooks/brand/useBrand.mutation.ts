import { useMutation, useQueryClient } from '@tanstack/react-query';

import { brandQueryKey } from './useBrand.query';
import { BrandsAction } from '@/actions/brands.action';
import type { Brand } from '@prisma/client';
import { IBrandCreateEntity } from '@/interfaces';

export const useBrandMutation = () => {
  const queryClient = useQueryClient();

  function invalidateQueries() {
    queryClient.invalidateQueries({ queryKey: brandQueryKey });
  }

  const createBrand = useMutation({
    mutationFn: ({ brand }: { brand: IBrandCreateEntity }) => BrandsAction.create(brand),
    onSuccess: () => alert('Brand created successfully'),
    onError: () => alert('Error creating brand'),
    onSettled: invalidateQueries,
  });

  const updateBrand = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Brand }) => {
      return BrandsAction.update(id, payload);
    },
    onSuccess: () => alert('Brand updated successfully'),
    onError: () => alert('Error updating brand'),
    onSettled: invalidateQueries,
  });

  const removeBrand = useMutation({
    mutationFn: (id: string) => BrandsAction.remove(id),
    onSuccess: () => alert('Brand removed successfully'),
    onError: () => alert('Error removing brand'),
    onSettled: invalidateQueries,
  });

  return {
    createBrand,
    updateBrand,
    removeBrand,
  };
};
