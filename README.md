# Freedom Wall

A 2008-inspired public Wall with text and photo posts, built with React 19, Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, and Supabase. Follows the [Facebook Wall Challenge guide](https://tremendous-tiger-a4a.notion.site/Step-by-Step-Facebook-Wall-Challenge-Test-2-22300bbdfc3b80c3886cd8b22779ed09).

## Run locally

Requires Node.js 22.18 or newer (the built-in test runner executes TypeScript).

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000. VS Code also has **Freedom Wall: localhost** and **Freedom Wall: production build** tasks.

Without Supabase environment values, the app shows a **Local preview** indicator, three labeled sample posts, and browser storage persistence. These posts are only on your browser; they are not in Supabase. Connecting Supabase starts a separate real feed and does not upload preview messages. Preview posts synchronize between tabs on the same browser origin.

## What I need from your Supabase project

Only these two public connection values:

1. **Project URL**, such as `https://your-project.supabase.co`.
2. **Publishable API key** (`sb_publishable_...`) or legacy **anon public key** (`eyJ...`). Use either in `NEXT_PUBLIC_SUPABASE_ANON_KEY` to match the guide's environment variable name.

Find them in your project's **Connect** dialog or **Settings → API / API Keys**. Never put a secret key, `service_role` key, or database password in the app. Public browser keys rely on the database's row-level security policies.

### 1. Prepare the database

Create your Supabase project, open **SQL Editor**, and run the entire [supabase/schema.sql](./supabase/schema.sql).

It uses the guide's table layout: `posts(id, user_id, body, created_at)`. It also adds:

- Required body and timestamp, nonblank messages, and a database-enforced 280-character limit.
- Row-level security and explicit grants: anonymous visitors may read and insert **body only**. They cannot update or delete, or supply a timestamp or user ID.
- A newest-first index and registration in the `supabase_realtime` publication.

The script can be rerun. If you already have invalid/null messages in an existing table, validation fails and the transaction rolls back; it does not delete them. Resolve those rows before rerunning. Use a dedicated challenge project/table, since grants on `posts` are intentionally limited to this no-login application.

### 2. Set your local connection values

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

Restart the dev server. The browser should show **The wall is live** after the Realtime subscription connects. If only one environment value is set, configuration fails visibly. Database failures never silently save to browser storage.

### 3. Verify the challenge

1. Type a message or attach a photo and press **Share**. Empty/whitespace messages require a photo; captions allow 280 Unicode characters.
2. Verify the row in Supabase **Table Editor → posts**. New rows use a database-generated UUID/timestamp; `user_id` stays null. All posts display the fixed name **Wall Visitor**.
3. Refresh: the message remains, with newest posts first.
4. Open a second browser window. Share in one window and confirm the other receives the post without refreshing.
5. Try a failed save (e.g. go offline). The draft remains and an error appears.

The feed fetches successive 1000-row batches to avoid Supabase's default read cap. Realtime insert responses are deduplicated against Share responses. Reconnection fetches the feed again to recover missed inserts. The refresh button is available if the Realtime connection is unavailable.

## Photo sharing

Run [supabase/photos.sql](./supabase/photos.sql) in your project's **SQL Editor**, after the base schema. The public browser key cannot run schema migrations or create buckets; use the Supabase dashboard. No additional environment values are needed.

The migration preserves existing posts and adds:

- An optional `posts.image_path`, with a constraint allowing only generated image filenames.
- Photo-only posts (empty caption), while continuing to reject posts with neither text nor photo.
- A public `wall-photos` Storage bucket limited to **5 MB** and JPEG, PNG, WebP, or GIF.
- Anonymous insert permission scoped to that bucket and generated filenames. Visitors cannot overwrite or delete photos.

Click **Add photo**, choose an image, review the preview, optionally write a caption, then **Share**. There is one photo per post. The browser checks type, size, and image decoding before accepting a selection. Storage enforces size and allowed MIME types. SVG, HEIC, video, and empty files are rejected. Captions and file selections remain after a failed upload/save; a successfully uploaded photo is reused if the post save is retried. Photos appear in Realtime posts and after refresh; click one to view the full image. Photo uploads require a connected Supabase project and are disabled in browser-only preview.

**Verify:** share a photo with a caption and one without; confirm the file in **Storage → wall-photos**, the path in **posts**, persistence after refresh, and arrival in another open window. Try an oversized/unsupported file and confirm it is rejected without an upload. Text-only posts continue working before and after the migration.

**Rollback without data loss:** deploy the previous text-only UI to stop accepting photos. Keep `image_path`, the bucket, and existing objects; deleting them would lose uploaded photos. To fully disable uploads, remove only the `Visitors can upload wall photos` insert policy. Do not rerun the old body-only constraint over photo-only rows.

**Storage limit:** an upload and a database insert are separate operations. If a visitor uploads successfully but abandons a failed post, that unreferenced object remains in Storage; retries in the same composer reuse it. Anonymous delete access is intentionally unavailable. Clean up abandoned objects through an admin process when needed.

## Checks

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Tests cover input boundaries, Unicode, ordering (including PostgreSQL microseconds), preview persistence/corruption/write failure, duplicate event merging, database request bodies, batching, failed requests, and incomplete configuration. Mocked database checks do not replace the live Supabase checks above.

## Vercel later

1. Push this folder to your GitHub repository.
2. Import it into Vercel; choose the **Next.js** framework preset.
3. Add the same two environment variables for Production (and Preview if desired).
4. Deploy. The default build command is `npm run build`; no custom output directory is needed.
5. Test Share, database persistence, refresh, and two-window Realtime using the production URL.

Environment values are embedded during the Next.js build. Redeploy after changing them. This workspace does not create or deploy a Vercel project.

## Scope and limits

No login, likes, comments, edit/delete, or moderation tools. Messages and uploaded photos are public once connected. The open posting policy is appropriate for this challenge; before promoting a public wall broadly, add abuse controls/rate limits. Browser preview storage is tied to its origin (`localhost` and `127.0.0.1` use different storage) and intended for one writer at a time; simultaneous preview writes in multiple tabs are not atomic. Use Supabase for concurrent visitors.

The [implementation plan](./docs/superpowers/plans/2026-11-15-freedom-wall.md) tracks the work and remaining external verification.
