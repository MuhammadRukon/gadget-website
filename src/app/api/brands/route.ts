import { z } from 'zod';
import { IBrandCreateOrUpdateEntity } from '@/interfaces';
import { prisma } from '@/lib/prisma';
import { Brand, Prisma, Status } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ResponseStatus } from '@/enums';

export async function GET() {
  try {
    const brands = await getBrands();
    return NextResponse.json(brands);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}

export async function POST(request: Request) {
  const body: IBrandCreateOrUpdateEntity = await request.json();

  const BrandSchema = z.object({
    name: z.string(),
    slug: z.string(),
    status: z.enum(Status),
    imageUrl: z.string(),
  });

  const parsed = BrandSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues || parsed.error.message },
      { status: ResponseStatus.BadRequest },
    );
  }

  try {
    await prisma.brand.create({ data: body });

    return NextResponse.json(
      { message: 'Brand created successfully' },
      { status: ResponseStatus.Created },
    );
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const field = Array.isArray(err.meta?.target) ? err.meta?.target[0] : 'field';

      return NextResponse.json(
        { error: `A brand with this ${field} already exists` },
        { status: ResponseStatus.Conflict },
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}

async function getBrands(): Promise<Brand[]> {
  return await prisma.brand.findMany({
    orderBy: { createdAt: 'desc' },
  });
}
