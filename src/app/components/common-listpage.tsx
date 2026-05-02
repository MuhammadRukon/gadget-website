import { ProductFilters } from '@/modules/storefront/components/product-filters';
import { ProductGrid } from '@/modules/storefront/components/product-grid';
import { StorefrontPagination } from '@/modules/storefront/components/storefront-pagination';
import { IBrandOption, ICategoryOption } from '@/interfaces';
import { PublicProductPage } from '@/contracts';
import { $Enums } from '@prisma/client';

interface CommonListPageProps {
  brands: IBrandOption[];
  categories: ICategoryOption[];
  brand?: {
    id: string;
    name: string;
    slug: string;
    status: $Enums.PublishStatus;
  };
  page: PublicProductPage;
  title: string;
}

export default function CommonListPage({
  brands,
  categories,
  brand,
  page,
  title,
}: Readonly<CommonListPageProps>) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 py-6">
      <aside className="sticky md:top-31 self-start space-y-4 bg-background">
        <ProductFilters brands={brands} categories={categories} lockedBrandSlug={brand?.slug} />
      </aside>
      <section>
        <h1 className="text-2xl font-semibold mb-4">{title}</h1>
        <ProductGrid products={page.items} />
        <StorefrontPagination page={page.page} pageSize={page.pageSize} total={page.total} />
      </section>
    </div>
  );
}
