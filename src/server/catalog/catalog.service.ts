import { Prisma, PublishStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  BrandInput,
  CategoryInput,
  ProductInput,
  ProductListQuery,
  PublicProductDetail,
  PublicProductMetadata,
  PublicProductPage,
  PublicProductSummary,
  PublicProductVariant,
  VariantInput,
} from '@/contracts/catalog';
import { ConflictError, NotFoundError, ValidationError } from '@/server/common/errors';
import { applyDiscount } from '@/server/common/money';
import { slugify } from '@/server/common/slug';

import { catalogRepo } from './catalog.repo';

interface VariantPricing {
  priceCents: number;
  originalPriceCents: number;
  inStock: boolean;
}

function pricingFromVariant(v: {
  sellingPriceCents: number;
  discountCents: number;
  stock: number;
  isActive: boolean;
}): VariantPricing {
  return {
    priceCents: applyDiscount(v.sellingPriceCents, v.discountCents),
    originalPriceCents: v.sellingPriceCents,
    inStock: v.isActive && v.stock > 0,
  };
}

function ensureUniqueSkus(variants: VariantInput[]) {
  const seen = new Set<string>();
  for (const v of variants) {
    if (seen.has(v.sku)) {
      throw new ValidationError('Duplicate SKU within product', { sku: v.sku });
    }
    seen.add(v.sku);
  }
}

function brandStatusOrDefault(input: BrandInput): PublishStatus {
  return input.status ?? PublishStatus.PUBLISHED;
}

function categoryStatusOrDefault(input: CategoryInput): PublishStatus {
  return input.status ?? PublishStatus.PUBLISHED;
}

function productStatusOrDefault(input: ProductInput): PublishStatus {
  return input.status ?? PublishStatus.DRAFT;
}

function uniqueConstraintField(err: Prisma.PrismaClientKnownRequestError): string {
  const target = err.meta?.target;
  if (Array.isArray(target)) return target[0] ?? 'field';
  return 'field';
}

export const catalogService = {
  // --- Brand ---------------------------------------------------------------

  listBrands() {
    return catalogRepo.listBrands();
  },

  async createBrand(input: BrandInput) {
    const slug = slugify(input.slug || input.name);
    try {
      return await catalogRepo.createBrand({
        name: input.name,
        slug,
        logoUrl: input.logoUrl ?? null,
        isPopular: input.isPopular ?? false,
        status: brandStatusOrDefault(input),
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`A brand with this ${uniqueConstraintField(err)} already exists`);
      }
      throw err;
    }
  },

  async updateBrand(id: string, input: BrandInput) {
    const slug = slugify(input.slug || input.name);
    try {
      return await catalogRepo.updateBrand(id, {
        name: input.name,
        slug,
        logoUrl: input.logoUrl ?? null,
        isPopular: input.isPopular ?? false,
        status: brandStatusOrDefault(input),
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictError(`A brand with this ${uniqueConstraintField(err)} already exists`);
        }
        if (err.code === 'P2025') throw new NotFoundError('Brand');
      }
      throw err;
    }
  },

  async deleteBrand(id: string) {
    try {
      await catalogRepo.deleteBrand(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') throw new NotFoundError('Brand');
        if (err.code === 'P2003') {
          throw new ConflictError(
            'This brand has products attached. Archive it instead of deleting.',
          );
        }
      }
      throw err;
    }
  },

  // --- Category ------------------------------------------------------------

  listCategories() {
    return catalogRepo.listCategories();
  },

  async createCategory(input: CategoryInput) {
    const slug = slugify(input.slug || input.name);
    try {
      return await catalogRepo.createCategory({
        name: input.name,
        slug,
        iconUrl: input.iconUrl ?? null,
        isPopular: input.isPopular ?? false,
        status: categoryStatusOrDefault(input),
        parent: input.parentId ? { connect: { id: input.parentId } } : undefined,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(
          `A category with this ${uniqueConstraintField(err)} already exists`,
        );
      }
      throw err;
    }
  },

  async updateCategory(id: string, input: CategoryInput) {
    const slug = slugify(input.slug || input.name);
    try {
      return await catalogRepo.updateCategory(id, {
        name: input.name,
        slug,
        iconUrl: input.iconUrl ?? null,
        isPopular: input.isPopular ?? false,
        status: categoryStatusOrDefault(input),
        parent: input.parentId ? { connect: { id: input.parentId } } : { disconnect: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictError(
            `A category with this ${uniqueConstraintField(err)} already exists`,
          );
        }
        if (err.code === 'P2025') throw new NotFoundError('Category');
      }
      throw err;
    }
  },

  async deleteCategory(id: string) {
    try {
      await catalogRepo.deleteCategory(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') throw new NotFoundError('Category');
        if (err.code === 'P2003') {
          throw new ConflictError(
            'This category has products attached. Archive it instead of deleting.',
          );
        }
      }
      throw err;
    }
  },

  // --- Product -------------------------------------------------------------

  listProducts() {
    return catalogRepo.listProductsAdmin();
  },

  async getProduct(id: string) {
    const product = await catalogRepo.findProduct(id);
    if (!product) throw new NotFoundError('Product');
    return product;
  },

  /**
   * Create a product together with its variants, images, and category links
   * in a single transaction. Failure rolls everything back so we never end
   * up with a half-saved product.
   */
  async createProduct(input: ProductInput) {
    ensureUniqueSkus(input.variants);
    const slug = slugify(input.slug || input.name);
    try {
      return await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name: input.name,
            slug,
            description: input.description,
            brandId: input.brandId,
            status: productStatusOrDefault(input),
            isPopular: input.isPopular ?? false,
            warrantyMonths: input.warrantyMonths,
            metaTitle: input.metaTitle ?? null,
            metaDescription: input.metaDescription ?? null,
            categories: {
              create: input.categoryIds.map((categoryId) => ({ categoryId })),
            },
            images: {
              create: input.images.map((img, idx) => ({
                url: img.url,
                publicId: img.publicId,
                alt: img.alt ?? null,
                sortOrder: img.sortOrder ?? idx,
              })),
            },
            variants: {
              create: input.variants.map((v) => ({
                sku: v.sku,
                name: v.name ?? null,
                attributes: v.attributes ?? {},
                buyingPriceCents: v.buyingPriceCents,
                sellingPriceCents: v.sellingPriceCents,
                discountCents: v.discountCents,
                stock: v.stock,
                lowStockThreshold: v.lowStockThreshold,
                isActive: v.isActive,
              })),
            },
          },
        });
        return product;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const field = uniqueConstraintField(err);
        if (field.toLowerCase().includes('sku')) {
          throw new ConflictError('SKU already in use', { field });
        }
        throw new ConflictError(`A product with this ${field} already exists`);
      }
      throw err;
    }
  },

  /**
   * Update product metadata + replace images / variants. Variants matched
   * by id are updated; new variants are created; missing ids that are
   * referenced by orders are deactivated rather than deleted (so the
   * historical FK from `OrderItem.variantId` stays valid).
   */
  async updateProduct(id: string, input: ProductInput) {
    ensureUniqueSkus(input.variants);
    const slug = slugify(input.slug || input.name);

    const existing = await catalogRepo.findProduct(id);
    if (!existing) throw new NotFoundError('Product');

    const incomingVariantIds = new Set(input.variants.filter((v) => v.id).map((v) => v.id!));
    const removedVariants = existing.variants.filter((v) => !incomingVariantIds.has(v.id));

    try {
      return await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: {
            name: input.name,
            slug,
            description: input.description,
            brandId: input.brandId,
            status: productStatusOrDefault(input),
            isPopular: input.isPopular ?? false,
            warrantyMonths: input.warrantyMonths,
            metaTitle: input.metaTitle ?? null,
            metaDescription: input.metaDescription ?? null,
          },
        });

        await tx.productCategory.deleteMany({ where: { productId: id } });
        if (input.categoryIds.length > 0) {
          await tx.productCategory.createMany({
            data: input.categoryIds.map((categoryId) => ({ productId: id, categoryId })),
          });
        }

        await tx.productImage.deleteMany({ where: { productId: id } });
        if (input.images.length > 0) {
          await tx.productImage.createMany({
            data: input.images.map((img, idx) => ({
              productId: id,
              url: img.url,
              publicId: img.publicId,
              alt: img.alt ?? null,
              sortOrder: img.sortOrder ?? idx,
            })),
          });
        }

        for (const v of input.variants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                sku: v.sku,
                name: v.name ?? null,
                attributes: v.attributes ?? {},
                buyingPriceCents: v.buyingPriceCents,
                sellingPriceCents: v.sellingPriceCents,
                discountCents: v.discountCents,
                stock: v.stock,
                lowStockThreshold: v.lowStockThreshold,
                isActive: v.isActive,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                sku: v.sku,
                name: v.name ?? null,
                attributes: v.attributes ?? {},
                buyingPriceCents: v.buyingPriceCents,
                sellingPriceCents: v.sellingPriceCents,
                discountCents: v.discountCents,
                stock: v.stock,
                lowStockThreshold: v.lowStockThreshold,
                isActive: v.isActive,
              },
            });
          }
        }

        for (const removed of removedVariants) {
          const refCount = await tx.orderItem.count({ where: { variantId: removed.id } });
          if (refCount > 0) {
            await tx.productVariant.update({
              where: { id: removed.id },
              data: { isActive: false },
            });
          } else {
            await tx.productVariant.delete({ where: { id: removed.id } });
          }
        }

        return tx.product.findUnique({
          where: { id },
          include: catalogRepo.productInclude,
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const field = uniqueConstraintField(err);
        if (field.toLowerCase().includes('sku')) {
          throw new ConflictError('SKU already in use', { field });
        }
        throw new ConflictError(`A product with this ${field} already exists`);
      }
      throw err;
    }
  },

  // --- Public storefront ---------------------------------------------------

  async listPublicCategories() {
    return prisma.category.findMany({
      where: { status: PublishStatus.PUBLISHED },
      orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, parentId: true, isPopular: true },
    });
  },

  async listPublicBrands() {
    return prisma.brand.findMany({
      where: { status: PublishStatus.PUBLISHED },
      orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, isPopular: true },
    });
  },

  /**
   * Build the Where clause for a public product query, sharing the
   * status filter, full-text search, and category/brand selection.
   */
  buildPublicProductWhere(query: ProductListQuery): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      status: PublishStatus.PUBLISHED,
    };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.brandSlug) {
      where.brand = { slug: query.brandSlug };
    }
    if (query.categorySlug) {
      where.categories = {
        some: { category: { slug: query.categorySlug } },
      };
    }
    if (query.inStock) {
      where.variants = { some: { isActive: true, stock: { gt: 0 } } };
    }
    return where;
  },

  async listPublicProducts(query: ProductListQuery): Promise<PublicProductPage> {
    const pageSize = Math.min(60, Math.max(1, query.limit ?? 12));
    const page = Math.max(1, query.page ?? 1);
    const skip = (page - 1) * pageSize;
    const sort = query.sort ?? 'newest';

    const where = this.buildPublicProductWhere(query);

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.variants = {
        ...(where.variants ?? {}),
        some: {
          ...(typeof where.variants === 'object' && where.variants && 'some' in where.variants
            ? where.variants.some
            : {}),
          isActive: true,
          ...(query.minPrice !== undefined ? { sellingPriceCents: { gte: query.minPrice } } : {}),
          ...(query.maxPrice !== undefined ? { sellingPriceCents: { lte: query.maxPrice } } : {}),
        },
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: 'desc' }];

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          slug: true,
          name: true,
          isPopular: true,
          brand: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          variants: {
            where: { isActive: true },
            orderBy: { sellingPriceCents: 'asc' },
            take: 1,
            select: {
              sellingPriceCents: true,
              discountCents: true,
              stock: true,
            },
          },
          _count: {
            select: {
              variants: {
                where: {
                  isActive: true,
                  stock: { gt: 0 },
                },
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const sortedRows =
      sort === 'newest'
        ? rows
        : [...rows].sort((a, b) => {
            const aPrice = a.variants[0]?.sellingPriceCents ?? Number.POSITIVE_INFINITY;
            const bPrice = b.variants[0]?.sellingPriceCents ?? Number.POSITIVE_INFINITY;

            if (aPrice === bPrice) {
              return b.createdAt.getTime() - a.createdAt.getTime();
            }

            return sort === 'price_asc' ? aPrice - bPrice : bPrice - aPrice;
          });

    const items: PublicProductSummary[] = sortedRows.map((p) => {
      const variant = p.variants[0];
      const pricing = variant
        ? pricingFromVariant({
            sellingPriceCents: variant.sellingPriceCents,
            discountCents: variant.discountCents,
            stock: variant.stock,
            isActive: true,
          })
        : { priceCents: 0, originalPriceCents: 0, inStock: false };
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        imageUrl: p.images[0]?.url ?? null,
        priceCents: pricing.priceCents,
        originalPriceCents: pricing.originalPriceCents,
        inStock: p._count.variants > 0,
        isPopular: p.isPopular,
      };
    });

    return { items, total, page, pageSize };
  },

  async getPublicProductBySlug(slug: string): Promise<PublicProductDetail> {
    const product = await prisma.product.findFirst({
      where: { slug, status: PublishStatus.PUBLISHED },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        warrantyMonths: true,
        metaTitle: true,
        metaDescription: true,
        brand: { select: { id: true, name: true, slug: true } },
        categories: {
          select: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: { url: true, alt: true },
        },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            sku: true,
            name: true,
            attributes: true,
            sellingPriceCents: true,
            discountCents: true,
            stock: true,
            isActive: true,
          },
        },
      },
    });
    if (!product) {
      throw new NotFoundError('Product');
    }

    const variants: PublicProductVariant[] = product.variants.map((v) => {
      const p = pricingFromVariant(v);
      return {
        id: v.id,
        sku: v.sku,
        name: v.name,
        attributes: (v.attributes as Record<string, string>) ?? {},
        priceCents: p.priceCents,
        originalPriceCents: p.originalPriceCents,
        inStock: p.inStock,
      };
    });

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      warrantyMonths: product.warrantyMonths,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      brand: product.brand,
      categories: product.categories.map((c) => c.category),
      images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
      variants,
    };
  },

  // async getPublicProductMetadataBySlug(slug: string): Promise<PublicProductMetadata> {
  //   const product = await prisma.product.findUnique({
  //     where: { slug },
  //     select: {
  //       slug: true,
  //       name: true,
  //       metaTitle: true,
  //       metaDescription: true,
  //       status: true,
  //       images: {
  //         orderBy: { sortOrder: 'asc' },
  //         take: 1,
  //         select: { url: true },
  //       },
  //     },
  //   });
  //   if (!product || product.status !== PublishStatus.PUBLISHED) {
  //     throw new NotFoundError('Product');
  //   }

  //   return {
  //     slug: product.slug,
  //     name: product.name,
  //     metaTitle: product.metaTitle,
  //     metaDescription: product.metaDescription,
  //     imageUrl: product.images[0]?.url ?? null,
  //   };
  // },

  /**
   * Delete only when the product has never been part of an order. Otherwise
   * archive it so historical orders keep working.
   */
  async deleteProduct(id: string) {
    const refs = await prisma.orderItem.count({ where: { productId: id } });
    if (refs > 0) {
      await prisma.product.update({
        where: { id },
        data: { status: PublishStatus.ARCHIVED },
      });
      return { archived: true as const };
    }
    try {
      await prisma.product.delete({ where: { id } });
      return { archived: false as const };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundError('Product');
      }
      throw err;
    }
  },
};
