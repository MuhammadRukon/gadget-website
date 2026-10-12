import { revalidatePath } from 'next/cache';

/**
 * Purge ISR output after an admin catalog write. Only call after the service
 * call succeeded. This is the only file allowed to import `next/cache`.
 */
export function revalidateCatalog({
  productSlug,
  previousSlug,
}: { productSlug?: string; previousSlug?: string } = {}): void {
  for (const slug of new Set([productSlug, previousSlug])) {
    if (slug) revalidatePath(`/products/${slug}`);
  }
  revalidatePath('/');
  revalidatePath('/', 'layout');
  revalidatePath('/sitemap.xml');
}
