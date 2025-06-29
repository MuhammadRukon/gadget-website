import SearchPage from '../components/search-page/search-page';

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

async function CategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const { category } = resolvedParams;

  return <SearchPage category={category} />;
}

export default CategoryPage;
