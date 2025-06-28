interface BrandPageProps {
  params: {
    category: string;
    brand: string;
  };
}

async function BrandPage({ params }: BrandPageProps) {
  const { category, brand } = params;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{brand.charAt(0).toUpperCase() + brand.slice(1)}</h1>
      <p className="text-gray-600 mb-4">
        Category: {category.charAt(0).toUpperCase() + category.slice(1)}
      </p>
    </div>
  );
}

export default BrandPage;
