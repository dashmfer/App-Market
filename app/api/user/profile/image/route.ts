import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { validateFile, isImageFile } from "@/lib/file-security";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(req);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

    const token = await getAuthToken(req);
    if (!token?.id) {
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

    // Delete old profile picture if it exists
    const currentUser = await prisma.user.findUnique({
      where: { id: token.id as string },
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
    const blob = await put(`profile-pictures/${token.id as string}-${Date.now()}.${ext}`, file, {
      access: "public",
    });

    // Update user profile with new image URL
    const updatedUser = await prisma.user.update({
      where: { id: token.id as string },
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

    const token = await getAuthToken(req);
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Remove profile picture
    const updatedUser = await prisma.user.update({
      where: { id: token.id as string },
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
