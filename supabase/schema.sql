-- Run in your Supabase project's SQL Editor. Keeps the guide's column names.
-- For a fresh project, run photos.sql afterward to enable photos.
-- This is the original text-only setup; do not rerun it over photo-only rows.
begin;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  body text not null check (char_length(body) <= 280),
  created_at timestamptz not null default now()
);

-- Also harden the guide's original table if you created it already.
-- Existing invalid rows cause an explicit rollback instead of data deletion.
alter table public.posts alter column body set not null;
alter table public.posts alter column created_at set not null;
alter table public.posts drop constraint if exists posts_body_valid;
alter table public.posts add constraint posts_body_valid
  check (char_length(body) between 1 and 280 and body ~ '[^[:space:]]');

create index if not exists posts_newest_first on public.posts (created_at desc, id desc);
alter table public.posts enable row level security;

revoke all on public.posts from anon, authenticated;
grant usage on schema public to anon;
grant select on public.posts to anon;
grant insert (body) on public.posts to anon;

drop policy if exists "Anyone can read the wall" on public.posts;
create policy "Anyone can read the wall" on public.posts
  for select to anon using (true);

drop policy if exists "Anyone can share a message" on public.posts;
create policy "Anyone can share a message" on public.posts
  for insert to anon with check (user_id is null);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

commit;
