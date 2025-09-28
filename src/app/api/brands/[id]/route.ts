import { ResponseStatus } from '@/enums';
import { IBrandCreateOrUpdateEntity } from '@/interfaces';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface IParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: IParams) {
  const { id } = await params;
  const body: IBrandCreateOrUpdateEntity = await request.json();
  console.log(body, 'body');
  try {
    const response = await updateBrand(id, body);
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

export async function DELETE(request: Request, { params }: IParams) {
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
