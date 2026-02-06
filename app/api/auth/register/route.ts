import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import prisma from "@/lib/db";
import { validatePasswordComplexity } from "@/lib/validation";
import { withRateLimit, getClientIp } from "@/lib/rate-limit";

// Rate limiter for registration
const rateLimitRegister = withRateLimit('auth', 'register');

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit registration attempts
    const rateLimit = rateLimitRegister(request);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.error },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const body = await request.json();
    const { name, email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // SECURITY: Validate password complexity
    const passwordValidation = validatePasswordComplexity(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join('. ') },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Unable to create account with the provided information" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Generate username from email
    const baseUsername = email.split("@")[0].toLowerCase().slice(0, 20);
    const existingUsername = await prisma.user.findFirst({
      where: { username: { startsWith: baseUsername } },
    });

    const username = existingUsername
      ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
      : baseUsername;

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { 
        message: "Account created successfully",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
