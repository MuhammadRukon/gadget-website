import { prisma } from '@/lib/prisma';
import { Prisma, Product } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ResponseStatus } from '@/enums';
import { productFormSchema } from '@/shared/schemas/product-form';

export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json(products);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json();

  const parsed = productFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues || parsed.error.message },
      { status: ResponseStatus.BadRequest },
    );
  }

  try {
    const { productCategories, ...productData } = parsed.data;

    const product = await prisma.product.create({
      data: {
        ...productData,
        productCategories: {
          create: productCategories.map((categoryId: string) => ({
            category: { connect: { id: categoryId } },
          })),
        },
      },
    });

    return NextResponse.json(
      { message: 'Product created successfully', product },
      { status: ResponseStatus.Created },
    );
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const field = Array.isArray(err.meta?.target) ? err.meta?.target[0] : 'field';

      return NextResponse.json(
        { error: `A product with this ${field} already exists` },
        { status: ResponseStatus.Conflict },
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}

async function getProducts(): Promise<Product[]> {
  return await prisma.product.findMany({
    include: {
      productCategories: {
        select: {
          category: {
            select: { name: true, id: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
