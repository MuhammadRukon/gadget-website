import { useQuery } from '@tanstack/react-query';
import { BrandsAction } from '@/actions/brands.action';

export const brandQueryKey = ['brand'];

export const useBrandQuery = () => {
  const getBrands = useQuery({
    queryKey: brandQueryKey,
    queryFn: async () => {
      const res = await BrandsAction.getAll();
      if (!res.ok) {
        //TODO: handle error
        console.error('Failed to fetch brands');
      }
      const data = await res.json();
      return data;
    },
  });

  return {
    getBrands,
  };
};
