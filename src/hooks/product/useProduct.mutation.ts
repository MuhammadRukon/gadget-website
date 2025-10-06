import { useMutation, useQueryClient } from '@tanstack/react-query';

import { productQueryKey } from '@/constants/queryKeys';
import { toast } from 'sonner';
import { IProductCreateOrUpdateEntity } from '@/interfaces';
import { ProductAction } from '@/actions/product.action';

export const useProductMutation = () => {
  const queryClient = useQueryClient();

  function invalidateQuery() {
    queryClient.invalidateQueries({ queryKey: productQueryKey });
  }

  const createProduct = useMutation({
    mutationFn: ({ product }: { product: IProductCreateOrUpdateEntity }) =>
      ProductAction.create(product),
    // onMutate: () => {}, TODO: implement optimistic update
    onSuccess: () => toast.success('Product created successfully'),
    onError: () => toast.error('Error creating product'),
    onSettled: invalidateQuery,
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: IProductCreateOrUpdateEntity }) => {
      return ProductAction.update(id, payload);
    },
    onSuccess: () => toast.success('Product updated successfully'),
    onError: () => toast.error('Error updating product'),
    onSettled: invalidateQuery,
  });

  const removeProduct = useMutation({
    mutationFn: (id: string) => ProductAction.remove(id),
    onSuccess: () => toast.success('Product removed successfully'),
    onError: () => toast.error('Error removing product'),
    onSettled: invalidateQuery,
  });

  return {
    createProduct,
    updateProduct,
    removeProduct,
  };
};
