# Freedom Wall

A public message wall inspired by Facebook in 2008. Share a short message, attach a photo, or both. No account needed.

**Live site:** [freedomwall-three.vercel.app](https://freedomwall-three.vercel.app/)

Built with React 19, Next.js, TypeScript, Tailwind CSS, shadcn/ui, and Supabase. Hosted on Vercel.

## Features

- Messages and captions up to 280 characters.
- One photo per post: JPG, PNG, WebP, or GIF, up to 5 MB.
- Newest posts first, with live updates through Supabase Realtime.
- Posts saved in Supabase Postgres and photos in Supabase Storage.
- Photo previews and drafts kept when a save fails.

All posts use the name **Wall Visitor**. Posts and photos are public.

## Run locally

Requires Node.js 22.18 or newer.

```sh
npm install
```

Copy `.env.example` to `.env.local` and add your Supabase connection values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

Use a publishable key or the legacy anon key. Do not use a service-role key. The local environment file is ignored by Git.

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000). Restart the server after changing environment values.

Without those values, the app runs in local preview mode. Preview posts stay in browser storage; photo uploads require Supabase.

## Supabase setup

For a new project, run these files in the Supabase SQL Editor, in order:

1. [supabase/schema.sql](./supabase/schema.sql) — creates the posts table, public read/insert policies, and Realtime publication.
2. [supabase/photos.sql](./supabase/photos.sql) — adds photo posts and the public `wall-photos` bucket with file size and type limits.

For an existing text-only installation, run only `photos.sql`. Do not rerun the original text-only schema over photo-only posts.

Visitors can add posts and upload photos, but cannot edit, delete, or overwrite them. Uploads abandoned after a failed post save may need to be cleaned up from Storage.

## Build and deploy

```sh
npm run build
npm start
```

To deploy your own copy, import the repository into Vercel using the Next.js preset and add the same two environment variables. Redeploy after changing them.
