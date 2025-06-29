import SearchPage from '../../components/search-page/search-page';

interface BrandPageProps {
  category: string;
  brand: string;
}

export default function BrandPage({ params }: { params: BrandPageProps }) {
  const { category, brand } = params;

  return <SearchPage category={category} brand={brand} />;
}
