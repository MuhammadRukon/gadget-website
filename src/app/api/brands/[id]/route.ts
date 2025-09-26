import { ResponseStatus } from '@/enums';
import { NextResponse } from 'next/server';

interface IParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: IParams) {
  const { id } = await params;

  try {
    // const brand = await getBrand(id);
    const brand = id;

    return NextResponse.json(brand);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unknown error occurred' },
      { status: ResponseStatus.InternalServerError },
    );
  }
}
