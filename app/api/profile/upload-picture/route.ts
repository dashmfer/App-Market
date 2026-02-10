import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';

/**
 * POST /api/profile/upload-picture
 * Upload profile picture
 */
export async function POST(req: NextRequest) {
  try {
    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - No active session found. Please sign in again.' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (MIME check)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // SECURITY: Validate file magic bytes to prevent disguised file uploads
    const buffer = Buffer.from(await file.arrayBuffer());
    const magicBytes = buffer.subarray(0, 12);
    const isJpeg = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
    const isPng = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    const isWebp = magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46 &&
                   magicBytes[8] === 0x57 && magicBytes[9] === 0x45 && magicBytes[10] === 0x42 && magicBytes[11] === 0x50;

    if (!isJpeg && !isPng && !isWebp) {
      return NextResponse.json(
        { error: 'File content does not match an allowed image format.' },
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

    // Upload to Vercel Blob Storage
    const blob = await put(`profile-pictures/${token.id as string}-${Date.now()}.${file.type.split('/')[1]}`, file, {
      access: 'public',
    });

    // Update user profile with new image URL
    const updatedUser = await prisma.user.update({
      where: { id: token.id as string },
      data: { image: blob.url },
      select: {
        id: true,
        image: true,
      },
    });

    return NextResponse.json({
      success: true,
      imageUrl: updatedUser.image,
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/upload-picture
 * Remove profile picture
 */
export async function DELETE(req: NextRequest) {
  try {
    const token = await getAuthToken(req);

    if (!token?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Remove profile picture
    await prisma.user.update({
      where: { id: token.id as string },
      data: { image: null },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error removing profile picture:', error);
    return NextResponse.json(
      { error: 'Failed to remove profile picture' },
      { status: 500 }
    );
  }
}
