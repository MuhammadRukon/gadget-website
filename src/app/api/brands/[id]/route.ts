import { ResponseStatus } from '@/enums';
import { IBrandCreateOrUpdateEntity } from '@/interfaces';
import { prisma } from '@/lib/prisma';
import { brandFormSchema } from '@/shared/schemas/brand-form';
import { NextResponse } from 'next/server';

interface IParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: IParams) {
  const { id } = await params;

  const body: unknown = await request.json();

  const parsed = brandFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: ResponseStatus.BadRequest },
    );
  }

  try {
    const response = await updateBrand(id, parsed.data);
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
    const response = await deleteBrand(id);
    if (response) {
      return new NextResponse(null, { status: ResponseStatus.NoContent });
    } else {
      throw new Error('Brand not found or could not be deleted');
    }
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}

async function updateBrand(id: string, body: IBrandCreateOrUpdateEntity) {
  return await prisma.brand.update({
    where: { id },
    data: body,
  });
}

async function deleteBrand(id: string) {
  return await prisma.brand.delete({
    where: { id },
  });
}
