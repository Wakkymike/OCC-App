import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { getAuthUser, isSuperAdmin } from '@/lib/auth/middleware';
import { signToken } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
    }

    const db = getDb();
    const passwordHash = await hashPassword(newPassword);

    db.prepare(`
      UPDATE users SET passwordHash = ?, passwordChangeRequired = 0, updatedAt = datetime('now')
      WHERE id = ?
    `).run(passwordHash, user.id);

    // Re-sign token since password changed
    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
