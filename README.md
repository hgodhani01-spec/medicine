# QueueLess (Step 1: frontend + database connection)

1. Create a free project at supabase.com.
2. SQL Editor > paste `supabase/schema.sql` > Run.
3. Project Settings > API: copy the Project URL and the **anon** key into `js/config.js`. Never use the service_role key.
4. Open `index.html` (or run `npx serve`). Demo doctors should load from the database.
5. Deploy: push to GitHub, import the repo in Vercel (Framework: Other, no build command).

Step 2 adds booking, lookup, cancellation and queue tracking. Run `supabase/migration_step2.sql` after `schema.sql`.
