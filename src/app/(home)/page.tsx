import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import Image from 'next/image';

export default function Home() {
  return (
    <div>
      <Carousel opts={{ loop: true }}>
        <CarouselContent>
          <CarouselItem>
            <Image
              className="w-full max-h-96 object-cover"
              src="/banner.webp"
              alt="banner-image-1"
              width={1000}
              height={1000}
            />
          </CarouselItem>
          <CarouselItem>
            <Image
              className="w-full max-h-96 object-cover"
              src="/banner.webp"
              alt="banner-image-1"
              width={1000}
              height={1000}
            />
          </CarouselItem>
        </CarouselContent>
      </Carousel>
    </div>
  );
}
