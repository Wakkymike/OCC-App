import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth/middleware';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0, // Expire immediately
  });
  return response;
}
