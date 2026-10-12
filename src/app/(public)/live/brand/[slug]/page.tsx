import { BrandListing, brandMetadata } from '@/app/components/listing-pages';
import { productListQuerySchema } from '@/contracts/catalog';

// Dynamic twin of /brand/[slug]: next.config rewrites filtered URLs here; the browser URL is unchanged.
interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Pick<PageProps, 'params'>) {
  return brandMetadata((await params).slug, true);
}

export default async function LiveBrandPage({ params, searchParams }: Readonly<PageProps>) {
  const query = productListQuerySchema.parse(await searchParams);
  return <BrandListing slug={(await params).slug} query={query} />;
}
