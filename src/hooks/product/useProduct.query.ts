import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ProductAction } from '@/actions/product.action';
import { useProductStore } from '@/stores/useProduct.store';
import { Product } from '@prisma/client';
import { productQueryKey } from '@/constants/queryKeys';

export const useProductQuery = () => {
  const getProducts = useQuery({
    queryKey: productQueryKey,
    // enabled: false,
    queryFn: async () => {
      const res = await ProductAction.getAll();

      if (!res.ok) throw new Error('Failed to fetch products');

      const data: Product[] = await res.json();

      return data;
    },
  });

  useEffect(() => {
    if (getProducts.isSuccess && getProducts.data) {
      useProductStore.setState({ products: getProducts.data });
    }
    if (getProducts.isError && getProducts.error) {
      console.error('Error fetching products', getProducts.error.message);
    }
  }, [getProducts.isSuccess, getProducts.data, getProducts.isError, getProducts.error]);

  return {
    getProducts,
  };
};
