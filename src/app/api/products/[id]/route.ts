import { ResponseStatus } from '@/enums';
import { IProductCreateOrUpdateEntity } from '@/interfaces';
import { prisma } from '@/lib/prisma';
import { productFormSchema } from '@/shared/schemas/product-form';

import { NextResponse } from 'next/server';

interface IParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: IParams) {
  const { id } = await params;

  const body: unknown = await request.json();

  const parsed = productFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: ResponseStatus.BadRequest },
    );
  }

  try {
    const response = await updateProduct(id, parsed.data);
    if (response) {
      return new NextResponse(null, { status: ResponseStatus.NoContent });
    } else {
      throw new Error('Something went wrong');
    }
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}

export async function DELETE(_: Request, { params }: IParams) {
  const { id } = await params;
  try {
    const response = await deleteProduct(id);
    if (response) {
      return new NextResponse(null, { status: ResponseStatus.NoContent });
    } else {
      throw new Error('Product not found or could not be deleted');
    }
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}

async function updateProduct(id: string, body: IProductCreateOrUpdateEntity) {
  const { productCategories, ...productData } = body;

  return await prisma.product.update({
    where: { id },
    data: {
      ...productData,
      productCategories: {
        deleteMany: {},
        create: productCategories.map((categoryId: string) => ({
          category: { connect: { id: categoryId } },
        })),
      },
    },
  });
}

async function deleteProduct(id: string) {
  return await prisma.product.delete({
    where: { id },
  });
}
