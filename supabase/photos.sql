-- Run once in your project's Supabase SQL Editor (safe to rerun).
-- Existing text posts are preserved. No secret key is needed in the app.
begin;

alter table public.posts add column if not exists image_path text;
alter table public.posts drop constraint if exists posts_image_path_valid;
alter table public.posts add constraint posts_image_path_valid check (
  image_path is null or image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'
);

alter table public.posts drop constraint if exists posts_body_valid;
alter table public.posts add constraint posts_body_valid check (
  char_length(body) <= 280 and (body ~ '[^[:space:]]' or image_path is not null)
);
grant insert (image_path) on public.posts to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wall-photos', 'wall-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Visitors can upload wall photos" on storage.objects;
create policy "Visitors can upload wall photos" on storage.objects
  for insert to anon with check (
    bucket_id = 'wall-photos' and
    name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'
  );

-- Public buckets serve photos without a SELECT/list policy.
-- No anonymous UPDATE/DELETE policy: visitors cannot replace or erase photos.
notify pgrst, 'reload schema';
commit;
