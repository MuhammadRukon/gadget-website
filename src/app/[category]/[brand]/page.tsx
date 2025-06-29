import SearchPage from '../../components/search-page/search-page';

interface BrandPageProps {
  params: {
    category: string;
    brand: string;
  };
}

async function BrandPage({ params }: BrandPageProps) {
  const { category, brand } = params;

  return <SearchPage category={category} brand={brand} />;
}

export default BrandPage;
