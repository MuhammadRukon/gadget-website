import { ResponseStatus } from '@/enums';
import { ICategoryCreateOrUpdateEntity } from '@/interfaces';
import { prisma } from '@/lib/prisma';
import { categoryFormSchema } from '@/shared/schemas/category-form';
import { NextResponse } from 'next/server';

interface IParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: IParams) {
  const { id } = await params;

  const body: unknown = await request.json();

  const parsed = categoryFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: ResponseStatus.BadRequest },
    );
  }

  try {
    const response = await updateCategory(id, parsed.data);
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
    const response = await deleteCategory(id);
    if (response) {
      return new NextResponse(null, { status: ResponseStatus.NoContent });
    } else {
      throw new Error('Category not found or could not be deleted');
    }
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}

async function updateCategory(id: string, body: ICategoryCreateOrUpdateEntity) {
  return await prisma.category.update({
    where: { id },
    data: body,
  });
}

async function deleteCategory(id: string) {
  return await prisma.category.delete({
    where: { id },
  });
}
