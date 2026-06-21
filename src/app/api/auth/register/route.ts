import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/middleware';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userId = uuidv4();

    // Auto-activate + grant admin if this is the super admin email
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    const isSuperAdmin = !!superEmail && normalizedEmail === superEmail.toLowerCase().trim();

    db.prepare(`
      INSERT INTO users (id, email, displayName, passwordHash, isActive, isAdmin)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, displayName || '', passwordHash, isSuperAdmin ? 1 : 0, isSuperAdmin ? 1 : 0);

    // Generate JWT
    const token = signToken({ userId, email: normalizedEmail });

    const response = NextResponse.json({
      user: {
        id: userId,
        email: normalizedEmail,
        displayName: displayName || '',
        isAdmin: isSuperAdmin,
        isSuperAdmin,
        isContentCreator: false,
        isActive: isSuperAdmin,
        passwordChangeRequired: false,
        forceSignOut: false,
        icalUrl: null,
      }
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
