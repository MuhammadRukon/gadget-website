interface CategoryPageProps {
  params: {
    category: string;
  };
}

async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = params;

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </h1>
    </>
  );
}

export default CategoryPage;
