import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/middleware';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/auth/finish-sign-up
 * Complete a sign-up via invitation: validate invitation, create user, delete invitation
 */
export async function POST(request: NextRequest) {
  try {
    const { invitationId, email, password, displayName } = await request.json();

    if (!invitationId || !email || !password) {
      return NextResponse.json({ error: 'Invitation ID, email, and password are required.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();

    // Verify invitation exists and matches email
    const invitation = db.prepare('SELECT * FROM invitations WHERE id = ?').get(invitationId) as any;
    if (!invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation.' }, { status: 404 });
    }
    if (invitation.email.toLowerCase() !== normalizedEmail) {
      return NextResponse.json({ error: 'Email does not match invitation.' }, { status: 400 });
    }

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userId = uuidv4();

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, displayName, passwordHash, isActive)
        VALUES (?, ?, ?, ?, 0)
      `).run(userId, normalizedEmail, displayName || '', passwordHash);

      // Delete the invitation
      db.prepare('DELETE FROM invitations WHERE id = ?').run(invitationId);
    });

    transaction();

    const token = signToken({ userId, email: normalizedEmail });

    const response = NextResponse.json({
      user: {
        id: userId,
        email: normalizedEmail,
        displayName: displayName || '',
        isActive: false,
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
    console.error('Finish sign-up error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
