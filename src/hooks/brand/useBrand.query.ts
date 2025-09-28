import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrandAction } from '@/actions/brand.action';
import { useBrandStore } from '@/stores/useBrand.store';
import { Brand } from '@prisma/client';
import { brandQueryKey } from '@/constants/queryKeys';

export const useBrandQuery = () => {
  const getBrands = useQuery({
    queryKey: brandQueryKey,
    // enabled: false,
    queryFn: async () => {
      const res = await BrandAction.getAll();

      if (!res.ok) throw new Error('Failed to fetch brands');

      const data: Brand[] = await res.json();

      return data;
    },
  });

  useEffect(() => {
    if (getBrands.isSuccess && getBrands.data) {
      useBrandStore.setState({ brands: getBrands.data });
    }
    if (getBrands.isError && getBrands.error) {
      console.error('Error fetching brands', getBrands.error.message);
    }
  }, [getBrands.isSuccess, getBrands.data, getBrands.isError, getBrands.error]);

  return {
    getBrands,
  };
};
