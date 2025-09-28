import { prisma } from '@/lib/prisma';
import { Category, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ResponseStatus } from '@/enums';
import { categoryFormSchema } from '@/shared/schemas/category-form';

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json(categories);
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

  const parsed = categoryFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues || parsed.error.message },
      { status: ResponseStatus.BadRequest },
    );
  }

  try {
    await prisma.category.create({ data: parsed.data });

    return NextResponse.json(
      { message: 'Category created successfully' },
      { status: ResponseStatus.Created },
    );
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const field = Array.isArray(err.meta?.target) ? err.meta?.target[0] : 'field';

      return NextResponse.json(
        { error: `A category with this ${field} already exists` },
        { status: ResponseStatus.Conflict },
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}

async function getCategories(): Promise<Category[]> {
  return await prisma.category.findMany({
    orderBy: { createdAt: 'desc' },
  });
}
