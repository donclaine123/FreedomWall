import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase.ts';

export const PHOTO_BUCKET = 'wall-photos';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/;

export function validatePhoto(file: File): string | null {
  if (!Object.hasOwn(PHOTO_TYPES, file.type)) return 'Choose a JPG, PNG, WebP, or GIF photo.';
  if (file.size === 0) return 'This photo is empty. Please choose another.';
  if (file.size > MAX_PHOTO_BYTES) return 'Choose a photo that is 5 MB or smaller.';
  return null;
}

export async function uploadPhoto(client: SupabaseClient<Database>, file: File): Promise<string> {
  const validationError = validatePhoto(file);
  if (validationError) throw new Error(validationError);
  const extension = PHOTO_TYPES[file.type as keyof typeof PHOTO_TYPES];
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type, cacheControl: '3600', upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}

export function getPhotoUrl(client: SupabaseClient<Database>, path: string): string | null {
  if (!PHOTO_PATH.test(path)) return null;
  return client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
