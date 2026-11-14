import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase.ts';
import { sortPosts, validateMessage, type Post } from './posts.ts';

export const STORAGE_KEY = 'freedom-wall-preview-v1';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

const samplePosts: Post[] = [
  { id: 'demo-3', user_id: null, body: 'Bring back wall posts, questionable status updates, and saying hi just because. Welcome to Freedom Wall. 👋', created_at: '2026-11-14T16:45:00Z' },
  { id: 'demo-2', user_id: null, body: 'Today’s small win: finally closing the 37 tabs I had open. Emotionally, at least.', created_at: '2026-11-14T16:30:00Z' },
  { id: 'demo-1', user_id: null, body: 'If this were 2008, my status would definitely be “listening to music and avoiding homework.” Some things never change. 🎧', created_at: '2026-11-14T16:00:00Z' },
];

export function loadLocalPosts(storage: Storage): Post[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [...samplePosts];
  const posts: unknown = JSON.parse(raw);
  if (!Array.isArray(posts) || !posts.every(post =>
    post && typeof post.id === 'string' && typeof post.body === 'string' &&
    validateMessage(post.body) === null && post.user_id === null &&
    typeof post.created_at === 'string' && Number.isFinite(Date.parse(post.created_at)))) {
    throw new Error('Your stored messages could not be read. They have not been changed.');
  }
  return sortPosts(posts);
}

export function saveLocalPost(storage: Storage, body: string): Post {
  const error = validateMessage(body);
  if (error) throw new Error(error);
  // shortcut: preview writes aren't atomic across tabs; use Supabase for concurrent visitors.
  const posts = loadLocalPosts(storage);
  const post: Post = { id: crypto.randomUUID(), user_id: null, body: body.trim(), created_at: new Date().toISOString() };
  storage.setItem(STORAGE_KEY, JSON.stringify(sortPosts([post, ...posts])));
  return post;
}

export async function loadPosts(client: SupabaseClient<Database>): Promise<Post[]> {
  const posts: Post[] = [];
  const batchSize = 1000;
  for (let offset = 0; ; offset += batchSize) {
    // Keep text reads compatible while the optional photo column is being rolled out.
    const { data, error } = await client.from('posts').select()
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (error) throw new Error(`Could not load the wall: ${error.message}`);
    posts.push(...data);
    if (data.length < batchSize) return sortPosts(posts);
  }
}

export async function publishPost(client: SupabaseClient<Database>, body: string, imagePath?: string): Promise<Post> {
  const validationError = validateMessage(body, !!imagePath);
  if (validationError) throw new Error(validationError);
  const { data, error } = await client.from('posts').insert({ body: body.trim(), ...(imagePath ? { image_path: imagePath } : {}) })
    .select().single();
  if (error) throw new Error(`Your message wasn’t shared: ${error.message}`);
  return data;
}
