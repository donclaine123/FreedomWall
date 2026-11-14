import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Post } from './posts.ts';

export type Database = {
  public: {
    Tables: {
      posts: {
        Row: Post;
        Insert: { body: string; image_path?: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

let client: SupabaseClient<Database> | undefined;

export function getSupabase(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Set both Supabase environment values, then restart the app.');
  client ??= createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
