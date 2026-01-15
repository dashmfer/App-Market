import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Production Health Check
 * Visit this on your live site to see what's broken
 */
export async function GET() {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  // Check 1: Environment Variables
  checks.envVars = {
    DATABASE_URL: !!process.env.DATABASE_URL ? '✅ Set' : '❌ MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || '❌ MISSING',
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ MISSING',
    GITHUB_ID: !!process.env.GITHUB_ID ? '✅ Set' : '❌ MISSING',
    GITHUB_SECRET: !!process.env.GITHUB_SECRET ? '✅ Set' : '❌ MISSING',
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN ? '✅ Set' : '❌ MISSING',
  };

  // Check 2: Database Connection
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$connect();
    const userCount = await prisma.user.count();
    checks.database = {
      status: '✅ Connected',
      userCount,
    };
    await prisma.$disconnect();
  } catch (error: any) {
    checks.database = {
      status: '❌ FAILED',
      error: error.message,
      hint: 'Check DATABASE_URL in Vercel env vars',
    };
  }

  // Check 3: Session/Auth
  try {
    const session = await getServerSession(authOptions);
    checks.session = {
      status: session ? '✅ Active session found' : '⚠️ No session (this is OK if not signed in)',
      hasUser: !!session?.user,
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
    };
  } catch (error: any) {
    checks.session = {
      status: '❌ FAILED',
      error: error.message,
      hint: 'Check NEXTAUTH_URL and NEXTAUTH_SECRET',
    };
  }

  // Check 4: Critical URLs
  checks.urls = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    isLocalhostUrl: process.env.NEXTAUTH_URL?.includes('localhost'),
    warning: process.env.NEXTAUTH_URL?.includes('localhost')
      ? '❌ NEXTAUTH_URL is set to localhost! Change it to your production domain!'
      : '✅ NEXTAUTH_URL looks good',
  };

  // Overall Status
  const hasAllEnvVars = Object.values(checks.envVars).every((v) => String(v).includes('✅'));
  const dbOk = String(checks.database.status).includes('✅');

  checks.overallStatus = hasAllEnvVars && dbOk
    ? '✅ All systems operational'
    : '❌ Issues detected - see details below';

  // Critical Issues Summary
  checks.criticalIssues = [];
  if (!hasAllEnvVars) {
    checks.criticalIssues.push('Missing environment variables - set them in Vercel dashboard');
  }
  if (!dbOk) {
    checks.criticalIssues.push('Database connection failed - check DATABASE_URL');
  }
  if (checks.urls.isLocalhostUrl) {
    checks.criticalIssues.push('NEXTAUTH_URL points to localhost - change to production domain');
  }

  return NextResponse.json(checks, {
    status: checks.criticalIssues.length > 0 ? 500 : 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
