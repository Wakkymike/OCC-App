import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/middleware';

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user });
}
