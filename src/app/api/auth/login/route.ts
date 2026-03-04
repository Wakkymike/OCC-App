import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Generate JWT
    const token = signToken({ userId: user.id, email: user.email });

    // Clear forceSignOut flag if it was set
    if (user.forceSignOut) {
      db.prepare('UPDATE users SET forceSignOut = 0 WHERE id = ?').run(user.id);
    }

    // Check if this is the super admin
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    const isSuperAdmin = !!superEmail && user.email === superEmail.toLowerCase().trim();

    // Auto-activate super admin in the DB if not already active
    if (isSuperAdmin && (!user.isActive || !user.isAdmin)) {
      db.prepare('UPDATE users SET isActive = 1, isAdmin = 1 WHERE id = ?').run(user.id);
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isAdmin: !!user.isAdmin || isSuperAdmin,
        isSuperAdmin,
        isContentCreator: !!user.isContentCreator,
        isActive: !!user.isActive || isSuperAdmin,
        passwordChangeRequired: !!user.passwordChangeRequired,
        forceSignOut: false,
        icalUrl: user.icalUrl,
      }
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
