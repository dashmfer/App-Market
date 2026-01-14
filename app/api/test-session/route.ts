import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Test endpoint to verify session is working
 * GET /api/test-session
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    return NextResponse.json({
      authenticated: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
      cookies: req.cookies.getAll().map(c => c.name),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get session',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
