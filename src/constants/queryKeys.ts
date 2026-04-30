/**
 * Centralized React Query keys. Keeping them in one place avoids
 * subtle cache misses caused by tuple/string drift between hooks.
 */
export const queryKeys = {
  brand: ['brand'] as const,
  category: ['category'] as const,
  product: ['product'] as const,
  productList: (params?: Record<string, unknown>) =>
    ['product', 'list', params ?? {}] as const,
  productBySlug: (slug: string) => ['product', 'slug', slug] as const,
  cart: ['cart'] as const,
  orders: ['orders'] as const,
  orderById: (id: string) => ['orders', id] as const,
};
