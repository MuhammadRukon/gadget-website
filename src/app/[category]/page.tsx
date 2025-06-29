import SearchPage from '../components/search-page/search-page';

interface CategoryPageProps {
  params: {
    category: string;
  };
}

async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = params;

  return <SearchPage category={category} />;
}

export default CategoryPage;
