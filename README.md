# Cold Arc

A 90-day Winter Arc tracker that installs to your iPhone home screen, works offline, and
costs nothing to run.

Pick 3–5 commitments, pick your window (September start, October start, run it into
February — all of it is yours to set), and hold the line. Journals and progress photos
never leave the device; only your daily score syncs, which is what makes squad
leaderboards possible.

---

## Getting it onto your phone

The whole thing is a static site on GitHub Pages plus a free Supabase project for the
social layer. No server, no hosting bill, no Apple Developer account.

### 1. Push to a public repo

GitHub Pages is only free on public repos. Your *data* stays private regardless — it lives
in your phone's IndexedDB and in Supabase, never in the repo.

```bash
gh repo create cold-arc --public --source=. --push
```

### 2. Turn on Pages

In the repo: **Settings → Pages → Source → GitHub Actions**. The next push to `main` builds
and deploys. Your app lands at `https://<you>.github.io/cold-arc/`.

If you name the repo something other than `cold-arc`, nothing needs changing — the workflow
derives the base path from the repo name.

### 3. Install it

Open that URL **in Safari** on your iPhone, then **Share → Add to Home Screen**.

Installing is not cosmetic. It is what makes the app open full-screen, run offline, keeps
iOS from evicting your data, and is a hard requirement for push notifications.


---

## Turning on the squad features

Solo tracking needs none of this. The Squad tab tells you it is unconfigured and
everything else keeps working.

**See [SETUP.md](SETUP.md) for the click-by-click version.** The summary follows.

### 1. Create a free Supabase project

At [supabase.com](https://supabase.com), new project, free tier. Note the region closest
to you.

### 2. Run the migration

Open **SQL Editor** in the Supabase dashboard, paste the whole of
`supabase/migrations/0001_init.sql`, and run it. That creates the tables, the row-level
security policies, and the RPCs for joining squads and settling duels.

### 3. Wire up the keys

**Project Settings → API** gives you the project URL and the `anon` public key.

Locally, put them in `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

For the deployed app, add the same two as repo secrets under **Settings → Secrets and
variables → Actions**. The deploy workflow injects them at build time.

The anon key ends up in the built JavaScript. That is normal and safe — it identifies the
project, it does not grant access. Row-level security is what actually protects the data,
which is why every table has it enabled and no policy exposes another user's rows unless
you share a squad or a duel with them.

### 4. Allow the redirect

**Authentication → URL Configuration**: add `https://<you>.github.io/cold-arc/**` to the
redirect allow-list, otherwise the magic link will bounce.

### Anti-pause

Free Supabase projects are paused after 7 days of inactivity. `.github/workflows/keepalive.yml`
pings the REST API weekly to prevent that. It no-ops harmlessly if you never configure
Supabase.

---

## Local development

```bash
npm install
npm run dev
```

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on :5173 |
| `npm test` | Scoring engine test suite |
| `npm run build` | Production build with service worker |
| `npm run preview` | Serve the built bundle |

In dev the Dexie instance is exposed as `window.db` for poking at from the console. It is
stripped from production builds.

---

## How scoring works

Everyone runs a different contract, so competing on raw numbers would be meaningless.
Instead everyone competes on **consistency against their own commitments**.

- **Day score** — weighted percentage of that day's *scheduled* commitments, with partial
  credit (15 of 20 pages scores 75).
- **Perfect day** — everything satisfied.
- **Streak** — consecutive days at or above the threshold: 100% in strict mode, 80% in
  forgiving. Grace tokens absorb a miss without breaking the chain, and are spent in
  chronological order.
- **Weekly total** — sum of day scores across a calendar week, 0–700.

Two details worth knowing:

**Weekly commitments don't punish rest days.** A "gym 5×/week" commitment is excluded from
the day score entirely while you're still on pace. It only counts as a miss once skipping
today would put the weekly quota out of reach.

**Leaderboards group by calendar week, not arc day.** Someone who started September 1 and
someone who started October 15 are judged on the same seven days, so joining late doesn't
bury you and finishing your arc doesn't hand you a lead.

All of it lives in `src/lib/scoring.ts` and is covered by `src/lib/scoring.test.ts`. Nothing
re-derives scores anywhere else.

---

## What syncs, and what doesn't

| Data | Leaves the device? |
| --- | --- |
| Daily score, completed counts, perfect-day flag | Yes — this is what the leaderboard reads |
| Current and longest streak | Yes |
| Arc name, window, commitment labels | Yes |
| Journal entries and mood | **No** |
| Progress photos | **No** |
| Exact logged values (steps, wake time) | **No** — only the derived percentage |

Because journals and photos are device-only, **the export in Settings is their only
backup.** Save it to Files or iCloud now and then.

---

## Architecture

```
src/
  db/schema.ts        Dexie tables — the source of truth
  lib/dates.ts        local YYYY-MM-DD everywhere, never timestamps
  lib/scoring.ts      the Arc Score engine
  lib/presets.ts      contract templates + arc window shortcuts
  lib/actions.ts      all mutations, plus the sync queue
  state/useArc.ts     live queries feeding every screen
  screens/            Today, Grid, Stats, Squad, Contract, Settings
```

Writes land in IndexedDB immediately and the UI never waits on the network. A queue drains
score rows to Supabase when online. If Supabase disappears tomorrow the app still works
completely as a solo tracker.

Dates are stored as local `YYYY-MM-DD` strings rather than instants. Storing timestamps
produces the classic bug where an 11pm log jumps to tomorrow for anyone east of UTC.

---

## Known iOS behaviour

- **Push notifications** need iOS 16.4+ *and* only work once the app is on the home screen.
- **No background sync** on iOS — syncing happens when you open the app and when you log.
- **Storage eviction** — Safari can clear data for unused sites. Installing to the home
  screen plus the `navigator.storage.persist()` request handles this, and scores have a
  cloud copy. Photos and journals are protected only by your export.
