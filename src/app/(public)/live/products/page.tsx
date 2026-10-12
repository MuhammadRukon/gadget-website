import { ProductsListing, productsMetadata } from '@/app/components/listing-pages';
import { productListQuerySchema } from '@/contracts/catalog';

// Dynamic twin of /products: next.config rewrites filtered URLs here; the browser URL is unchanged.
export const metadata = productsMetadata(true);

export default async function LiveProductsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = productListQuerySchema.parse(await searchParams);
  return <ProductsListing query={query} />;
}
