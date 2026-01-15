import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // Try to connect to the database
    await prisma.$connect();

    // Try a simple query
    const userCount = await prisma.user.count();

    // Test a specific user query (if any users exist)
    const firstUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      database: 'connected',
      userCount,
      firstUser: firstUser || 'No users found',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[DB Test] Database error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      errorName: error.name,
      errorCode: error.code,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
