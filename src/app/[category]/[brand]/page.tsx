import SearchPage from '../../components/search-page/search-page';

interface BrandPageProps {
  params: Promise<{
    category: string;
    brand: string;
  }>;
}

async function BrandPage({ params }: BrandPageProps) {
  const resolvedParams = await params;
  const { category, brand } = resolvedParams;

  return <SearchPage category={category} brand={brand} />;
}

export default BrandPage;
