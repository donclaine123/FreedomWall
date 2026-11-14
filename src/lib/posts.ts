export const MAX_CHARACTERS = 280;
export const AUTHOR_NAME = 'Wall Visitor';

export type Post = {
  id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  image_path?: string | null;
};

export function validateMessage(body: string, hasPhoto = false): string | null {
  if (!body.trim() && !hasPhoto) return 'Write a little something or add a photo before sharing.';
  if (Array.from(body).length > MAX_CHARACTERS) return 'Keep your message to 280 characters.';
  return null;
}

export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at) ||
    fractionalSeconds(b.created_at).localeCompare(fractionalSeconds(a.created_at)) ||
    b.id.localeCompare(a.id));
}

// Date.parse drops PostgreSQL microseconds, so preserve the fraction for ties.
function fractionalSeconds(timestamp: string): string {
  return (timestamp.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0');
}

export function mergePosts(existing: Post[], incoming: Post[]): Post[] {
  return sortPosts([...new Map([...existing, ...incoming].map(post => [post.id, post])).values()]);
}
