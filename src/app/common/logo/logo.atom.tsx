import Image from 'next/image';
import { LogoProps } from './logo.types';
import Link from 'next/link';

export function Logo({ src, alt = 'logo', width = 100, height = 100, className }: LogoProps) {
  return (
    <Link href="/">
      <Image src={src} alt={alt} width={width} height={height} className={className} />
    </Link>
  );
}
