'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Upload, X, Camera } from 'lucide-react';

interface ProfilePictureUploadProps {
  currentImage?: string | null;
  onImageUpdate?: (imageUrl: string) => void;
}

export default function ProfilePictureUpload({
  currentImage,
  onImageUpdate,
}: ProfilePictureUploadProps) {
  const { data: session, status } = useSession();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  console.log('[ProfilePictureUpload] Session status:', status, 'Has session:', !!session, 'User ID:', session?.user?.id);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check session first
    if (!session || !session.user?.id) {
      console.error('[ProfilePictureUpload] No active session found');
      setError('Session expired. Please sign in again.');
      return;
    }

    console.log('[ProfilePictureUpload] Uploading file for user:', session.user.id);

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP image');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('Image must be less than 5MB');
      return;
    }

    setError(null);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      console.log('[ProfilePictureUpload] Sending upload request...');
      const response = await fetch('/api/profile/upload-picture', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      console.log('[ProfilePictureUpload] Upload response status:', response.status);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      setPreviewUrl(data.imageUrl);
      onImageUpdate?.(data.imageUrl);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setPreviewUrl(currentImage || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    // Check session first
    if (!session || !session.user?.id) {
      console.error('[ProfilePictureUpload] No active session found for removal');
      setError('Session expired. Please sign in again.');
      return;
    }

    try {
      setUploading(true);

      console.log('[ProfilePictureUpload] Sending remove request...');
      const response = await fetch('/api/profile/upload-picture', {
        method: 'DELETE',
        credentials: 'include',
      });

      console.log('[ProfilePictureUpload] Remove response status:', response.status);

      if (!response.ok) {
        throw new Error('Failed to remove image');
      }

      setPreviewUrl(null);
      onImageUpdate?.('');
    } catch (err) {
      console.error('Remove error:', err);
      setError('Failed to remove image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Image Preview */}
      <div className="relative">
        <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center border-4 border-white dark:border-gray-900 shadow-lg">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Profile picture"
              width={128}
              height={128}
              className="object-cover w-full h-full"
            />
          ) : (
            <Camera className="w-12 h-12 text-gray-400" />
          )}
        </div>

        {/* Remove Button */}
        {previewUrl && !uploading && (
          <button
            onClick={handleRemove}
            className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition"
            title="Remove picture"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Loading Overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <div className="flex flex-col items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || status === 'loading' || !session}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          title={!session ? 'Please sign in to upload' : undefined}
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : status === 'loading' ? 'Loading...' : !session ? 'Sign in to upload' : previewUrl ? 'Change Picture' : 'Upload Picture'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          JPEG, PNG or WebP (max 5MB)
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
