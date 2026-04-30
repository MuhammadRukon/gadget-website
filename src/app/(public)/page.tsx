import Image from 'next/image';
import Link from 'next/link';

import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { catalogService } from '@/server/catalog/catalog.service';
import { ProductGrid } from '@/modules/storefront/components/product-grid';

export const metadata = {
  title: 'Tecnologia - gadgets & electronics',
  description: 'Discover the latest gadgets, laptops, phones and accessories.',
};

export const revalidate = 120;

export default async function HomePage() {
  const featured = await catalogService.listPublicProducts({ sort: 'newest', limit: 8 });

  return (
    <div className="space-y-10 py-6">
      <Carousel opts={{ loop: true }}>
        <CarouselContent>
          <CarouselItem>
            <Image
              className="w-full max-h-96 object-cover rounded"
              src="/banner.webp"
              alt="Storefront banner"
              width={1600}
              height={500}
              priority
            />
          </CarouselItem>
          <CarouselItem>
            <Image
              className="w-full max-h-96 object-cover rounded"
              src="/banner.webp"
              alt="Storefront banner"
              width={1600}
              height={500}
            />
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-xl md:text-2xl font-semibold">Featured products</h2>
          <Button asChild variant="link">
            <Link href="/products">Browse all</Link>
          </Button>
        </div>
        <ProductGrid products={featured.items} />
      </section>
    </div>
  );
}
