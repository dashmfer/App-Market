import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { validateFile, isImageFile } from "@/lib/file-security";
import { validateCsrfRequest, csrfError } from "@/lib/csrf";
import { withRateLimitAsync } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(req);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    // SECURITY: Rate limit image uploads (strict)
    const rateLimitResult = await (withRateLimitAsync('auth', 'user-profile-image'))(req);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type by MIME type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." },
        { status: 400 }
      );
    }

    // Additional security: validate by filename extension
    const fileValidation = validateFile(file.name);
    if (!fileValidation.allowed || !isImageFile(file.name)) {
      return NextResponse.json(
        { error: "Invalid file type. Only image files are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // SECURITY: Validate file content via magic bytes (not just MIME type)
    const buffer = await file.arrayBuffer();
    const magicBytes = new Uint8Array(buffer).slice(0, 12);
    const isJpeg = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
    const isPng = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    const isGif = magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46;
    const isWebp = magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46
      && magicBytes[8] === 0x57 && magicBytes[9] === 0x45 && magicBytes[10] === 0x42 && magicBytes[11] === 0x50;
    if (!isJpeg && !isPng && !isGif && !isWebp) {
      return NextResponse.json(
        { error: "File content does not match an allowed image format." },
        { status: 400 }
      );
    }

    // Reconstruct File from validated buffer for upload
    const validatedFile = new File([buffer], file.name, { type: file.type });

    // Delete old profile picture if it exists
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });
    if (currentUser?.image && currentUser.image.includes('blob.vercel-storage.com')) {
      try {
        const { del } = await import("@vercel/blob");
        await del(currentUser.image);
      } catch (e) {
        console.error("[Profile Image] Failed to delete old image:", e);
        // Continue with upload even if delete fails
      }
    }

    // Upload to Vercel Blob
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const blob = await put(`profile-pictures/${session.user.id}-${Date.now()}.${ext}`, validatedFile, {
      access: "public",
    });

    // Update user profile with new image URL
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: blob.url },
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        bio: true,
        image: true,
        websiteUrl: true,
        discordHandle: true,
      },
    });

    return NextResponse.json({
      success: true,
      imageUrl: blob.url,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    return NextResponse.json(
      { error: "Failed to upload profile picture" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(req);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Remove profile picture
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: null },
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        bio: true,
        image: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error removing profile picture:", error);
    return NextResponse.json(
      { error: "Failed to remove profile picture" },
      { status: 500 }
    );
  }
}
