import type { MetadataRoute } from 'next';
import { PublishStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '');
}

export const revalidate = 3600;
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: { status: PublishStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    }),
    prisma.category.findMany({
      where: { status: PublishStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
    }),
    prisma.brand.findMany({
      where: { status: PublishStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
  ];

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${base}/category/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const brandEntries: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${base}/brand/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticEntries, ...productEntries, ...categoryEntries, ...brandEntries];
}
