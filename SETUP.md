# Turning on squads — step by step

Do this only when you want the friend features. Solo tracking already works without any
of it, and the Squad tab will politely say it is not connected until you finish.

Everything below is free. No card required at any point.

Your values, already filled in:

| Thing | Value |
| --- | --- |
| App URL | `https://suyash2906.github.io/COLD_ARC/` |
| Repo | `suyash2906/COLD_ARC` |

---

## Step 1 — Create the Supabase project

1. Go to **[supabase.com](https://supabase.com)** and sign in with GitHub.
2. Click **New project**.
3. Fill in:
   - **Name:** `cold-arc`
   - **Database password:** click Generate, then **save it in your password manager**. You
     will not need it for this app, but you cannot recover it later.
   - **Region:** pick the one closest to you (for India, `South Asia (Mumbai)`).
   - **Plan:** Free
4. Click **Create new project** and wait ~2 minutes for it to finish provisioning.

---

## Step 2 — Create the tables

1. In the left sidebar click **SQL Editor**.
2. Click **New query**.
3. Open `supabase/migrations/0001_init.sql` from this repo, select **all** of it, and paste
   it into the editor.
4. Click **Run** (or Ctrl+Enter).

You should see `Success. No rows returned`. That is correct — it creates tables, not rows.

**If you see an error**, stop and send me the message. Do not run it twice hoping it
works; the script is safe to re-run, but an error means something needs fixing first.

To confirm it worked: click **Table Editor** in the sidebar. You should see six tables —
`profiles`, `arcs_public`, `daily_scores`, `squads`, `squad_members`, `duels`.

---

## Step 3 — Copy your two keys

1. Sidebar → **Project Settings** (gear icon) → **API**.
2. You need two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public** key — a long string starting `eyJ...`

Take the one labelled **anon public**, *not* `service_role`. The service_role key bypasses
all security. It must never go anywhere near this app.

The anon key is *designed* to be public and will end up visible in the app's JavaScript.
That is normal. It only identifies your project — the row-level security policies from
Step 2 are what actually control who can read what.

---

## Step 4 — Give the keys to GitHub

1. Go to **[the repo's Actions secrets](https://github.com/suyash2906/COLD_ARC/settings/secrets/actions)**.
2. Click **New repository secret**, twice:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Project URL from Step 3 |
| `VITE_SUPABASE_ANON_KEY` | your anon public key from Step 3 |

Names must match exactly, including the `VITE_` prefix.

---

## Step 5 — Let the magic link come back

This is the step people skip, and then sign-in silently fails.

1. Supabase sidebar → **Authentication** → **URL Configuration**.
2. Set **Site URL** to:
   ```
   https://suyash2906.github.io/COLD_ARC/
   ```
3. Under **Redirect URLs**, click Add URL and enter:
   ```
   https://suyash2906.github.io/COLD_ARC/**
   ```
   The `**` matters — the app returns to `.../COLD_ARC/?code=...#/squad`, and without the
   wildcard Supabase rejects it.
4. Save.

---

## Step 6 — Rebuild with the keys

Secrets are baked in at build time, so the currently deployed app does not have them yet.

Go to **[Actions](https://github.com/suyash2906/COLD_ARC/actions)** → click **Deploy to
GitHub Pages** in the left sidebar → **Run workflow** → **Run workflow**.

Wait for the green tick (about a minute).

---

## Step 7 — Test it

On your phone, open the app and **force-close it first** (swipe up from the app switcher)
so the service worker picks up the new build.

1. Open the **Squad** tab. It should now show a sign-in box instead of "No backend
   connected yet".
2. Enter your email → **Email me a link**.
3. Check your inbox and tap the link **on your phone**. It should bounce you back into the
   app, signed in.
4. Pick a handle and an emoji.
5. Tap **Start a squad**, name it, and you will get a 6-character invite code.
6. Send that code to a friend. They install the app the same way, sign in, choose **Join
   with a code**, and you will both appear on the leaderboard.

---

## What your friends see

| They can see | They cannot see |
| --- | --- |
| Your daily score % | Your journal entries |
| Your current streak | Your progress photos |
| Perfect-day count | Your mood ratings |
| Which day of your arc you are on | Exact numbers — that you read 14 pages, or woke at 05:47 |
| The names of your commitments | |

This is enforced in code, not just policy: no module that can reach the network is even
able to read the journal or photo tables, and there is a test that fails the build if that
ever changes.

---

## Troubleshooting

**"No backend connected yet" after Step 6** — the secrets were not picked up. Check the
names are exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then re-run the
workflow.

**The magic link opens a browser but does not sign me in** — Step 5. Make sure the
redirect URL ends in `**`.

**"No squad with that code"** — codes are 6 characters and case is ignored. Check for a
mistyped `0` vs `O` (the generator avoids ambiguous characters, so if you see a zero it is
a typo).

**The leaderboard is empty except me** — your friend has signed in but not logged a day
yet. Scores appear once they tick something off.

**It stopped working after a few weeks of nobody using it** — Supabase pauses free
projects after 7 days of inactivity. `.github/workflows/keepalive.yml` pings it weekly to
prevent this. If it still paused, open the Supabase dashboard and click Restore.
