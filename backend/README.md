# Torque Backend

The backend for Torque written in C#.

## Setup (do this once) (Written by Claude)

### 1. Install the tools

| Tool | Why | How |
|---|---|---|
| .NET 10 SDK | Builds and runs the backend | [Download page](https://dotnet.microsoft.com/download) |
| EF Core CLI | Applies database migrations | `dotnet tool install --global dotnet-ef` |
| Docker | Runs the local Postgres (the `db` service in [`compose.yaml`](../compose.yaml)) | [Docker Desktop](https://docs.docker.com/desktop/) or [Docker Engine](https://docs.docker.com/engine/install/) on Linux. Make sure the daemon is running (`docker ps` shouldn't error) |

### 2. Start Postgres

From the **repo root**:

```bash
docker compose up -d db
```

That's a plain `postgres:17` on `127.0.0.1:5432` (database, user and password are all
`torque`), with its data kept in a Docker volume between restarts. Any other Postgres
works too; just point `DB_CONNECTION_STRING` at it.

### 3. Create a Hack Club Auth app

Sign-in is [Hack Club Auth](https://auth.hackclub.com) (HCA) over OIDC, run by the
backend itself. Create an app at
[auth.hackclub.com/developer/apps](https://auth.hackclub.com/developer/apps) and add these
redirect URIs:

- `http://localhost:5267/auth/callback` (local `dotnet run`)
- `http://localhost:8080/auth/callback` (the Docker image via `docker compose`)
- `https://<your-domain>/auth/callback` (production)

The default scopes include `address` and `birthdate`, which the Airtable push needs and
which only HQ-official apps can request. With a community app, set
`HCA_SCOPES=openid profile email name slack_id verification_status`.

### 4. Create `backend/.env`

```bash
cp backend/example.env backend/.env
```

Then fill it in. The backend **won't start** without the required ones.

#### Required

| Variable | What to put | Where it comes from |
|---|---|---|
| `DB_CONNECTION_STRING` | `Host=127.0.0.1;Port=5432;Database=torque;Username=torque;Password=torque` | The compose `db` service. A hosted Postgres usually also wants `SSL Mode=Require` |
| `HCA_CLIENT_ID`, `HCA_CLIENT_SECRET` | OIDC app credentials | The HCA app from step 3 |
| `OAUTH_STATE_SECRET` | a random string | Generate one with `openssl rand -hex 32`. Signs the Hackatime OAuth `state` |
| `FRONTEND_URL` | `http://localhost:5173` | Where the frontend runs (`npm run dev` in `frontend/` uses port 5173). Only this origin is allowed through CORS, and it's where sign-in sends people back to. Use `localhost` here and in the frontend's `VITE_API_URL` (not `127.0.0.1`), or the session cookie won't be sent |
| `TOKEN_ENCRYPTION_KEY` | a random base64 key | Generate one with `openssl rand -base64 32`. Encrypts stored tokens, so don't change it later or the saved Hackatime and HCA tokens become unreadable |

`HCA_URL` (default `https://auth.hackclub.com`) and `HCA_SCOPES` (space-separated) are
optional overrides.

#### Optional integrations

Leave these blank to switch the feature off. The rest of the backend still works.

| Variable | What to put | Where it comes from |
|---|---|---|
| `HACKATIME_CLIENT_ID`, `HACKATIME_CLIENT_SECRET` | OAuth app credentials | Create an OAuth app on [Hackatime](https://hackatime.hackclub.com). Without these, the `api/hackatime/*` endpoints return 503 |
| `HACKATIME_REDIRECT_URI` | `http://localhost:5173/auth/hackatime/callback` | Where Hackatime sends people back after they approve access: the frontend's `/auth/hackatime/callback` page (Vite on 5173 locally, `https://<your-domain>/auth/hackatime/callback` in production). Must exactly match a redirect URI registered on the Hackatime OAuth app. The testing harness has its own callback at `http://localhost:5267/auth/hackatime/callback`; register that one too if you use it |
| `HACKATIME_BASE_URL` | `https://hackatime.hackclub.com` | Leave as is |
| `LAPSE_PROGRAM_KEY` | program key | Ask a Lapse admin. Lets reviewers see a project's timelapses |
| `LAPSE_BASE_URL` | `https://api.lapse.hackclub.com` | Leave as is |
| `AIRTABLE_API_KEY` | personal access token (`pat...`) | Create one at [airtable.com/create/tokens](https://airtable.com/create/tokens) with the `data.records:write` scope and access to the base |
| `AIRTABLE_BASE_ID` | `app...` | The `app...` part of the base's URL in Airtable |
| `AIRTABLE_TABLE_NAME` | `YSWS Project Submission` | Name of the table approved projects get pushed to |
| `AIRTABLE_WEBHOOK_SECRET` | a random string, 32+ characters | Generate one with `openssl rand -hex 32`. The Airtable approval automation sends it in the `X-Webhook-Secret` header when it calls `api/airtable/approve`. Blank or under 32 characters switches the webhook off (it returns 503) |
| `SLACK_BOT_TOKEN` | bot token (`xoxb-...`) | Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) with the bot scopes `chat:write`, `im:write`, `channels:manage` (to invite to public channels) and `groups:write` (private channels) and `users:read` (new accounts start with the user's Slack display name and profile picture), install it to the workspace, and copy the Bot User OAuth Token. The bot DMs builders when they finish onboarding, ship, get a review back (changes needed / rejected, with the feedback) and get final approval, plus streak DMs: an 8 PM (their time) reminder when a streak still needs today's hour, a streak freeze being used, a streak resetting, and a project reaching its max streak. Blank switches Slack off |
| `SLACK_JOIN_CHANNELS` | comma-separated channel IDs (`C0123ABC,C0456DEF`) | The channels `api/slack/channels/join` adds a user to (right-click a channel → *Copy link*; the ID is the last part). **Invite the bot to each one first** (`/invite @YourBot`) — Slack refuses invites to channels the bot isn't in |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` | Cloudflare dashboard → R2 → your bucket → *Settings* → S3 API. Any S3-compatible store works. Without the `S3_*` vars, `api/upload/image` returns 503 and nobody can add photos |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | API token key pair | R2 → *Manage API tokens* → create one with **Object Read & Write** on the bucket |
| `S3_BUCKET_NAME` | `torque-uploads` | The bucket's name |
| `S3_PUBLIC_URL` | `https://cdn.your-domain.com` | The bucket's public URL: R2 → bucket → *Settings* → connect a custom domain (or enable the r2.dev URL, which is rate-limited). Uploaded images are served from here |

### 5. Create the database tables

From `backend/`:

```bash
dotnet ef database update
```

Run this again whenever you pull new migrations (new files in
`backend/modules/data/Migrations/`; older ones are in `backend/Data/Migrations/`).

## Running (every time)

1. Make sure Docker is running, then start Postgres from the **repo root**
   (does nothing if it's already up):

   ```bash
   docker compose up -d db
   ```

2. Start the backend from **`backend/`** (it reads `.env` from the folder you run
   it in):

   ```bash
   dotnet watch
   ```

The API runs at <http://localhost:5267> and restarts when you change code.
Check it's up:

```bash
curl http://localhost:5267/api/health
```

To stop: `Ctrl-C` the backend, and `docker compose stop db` (from the repo root) if
you want to shut Postgres down too. Your data is kept between restarts.

## Testing

**DISCLAIMER:** This part was done using AI

`./testing/run.sh` brings up Postgres and the backend, and serves a test harness at
<http://localhost:5267/testing/> that signs in with Hack Club Auth and sends authenticated
requests to every endpoint below. See [testing/README.md](testing/README.md).

## Deploying with Docker

Production runs as **one Docker container** built from the [`Dockerfile`](../Dockerfile)
in the repo root. The image builds the frontend, then the backend serves the site and the API from
one URL: `/api/*` is the API, and every other path is the React app. Because both are on
one origin, the frontend needs no `VITE_*` build vars and there's no CORS to set up. On
boot the container also applies any pending database migrations by itself, so you never
run `dotnet ef database update` in production.

### Try the image locally first

From the **repo root**:

```bash
docker compose up --build
```

Then open <http://localhost:8080>. This reads `backend/.env` just like `dotnet watch`
does, except that it talks to the compose `db` service and sets `FRONTEND_URL` to
`http://localhost:8080`. `Ctrl-C` stops it.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Postgres URL, `postgres://user:pass@host:port/db` (or `DB_CONNECTION_STRING`) |
| `FRONTEND_URL` | The public URL, e.g. `https://torque.hackclub.com` (used in Slack links + CORS) |
| `HCA_CLIENT_ID`, `HCA_CLIENT_SECRET` | The HCA app, with `https://<your-domain>/auth/callback` registered |
| `OAUTH_STATE_SECRET` | A **new** `openssl rand -hex 32` for production |
| `TOKEN_ENCRYPTION_KEY` | A **new** `openssl rand -base64 32` for production. Keep it safe; changing it later breaks saved Hackatime links and HCA tokens |
| `HACKATIME_REDIRECT_URI` | `https://<your-domain>/...` callback, also registered on the Hackatime OAuth app |
| Everything under [Optional integrations](#optional-integrations) | Same as local |

No secrets reach the browser: `/config.js` only tells the frontend the API is on the
same origin, and the session is an HttpOnly cookie. If a proxy terminates TLS in front of
the container, it must send `X-Forwarded-Proto` so the OIDC redirect URI and the cookie's
`Secure` flag use `https`. The cookie-signing keys are stored in Postgres
(`data_protection_keys`), so restarts and extra instances don't sign anyone out.

Other knobs: `PORT` (default `80` in the image; `docker compose` sets `8080`), and `MIGRATE_ON_STARTUP=false` to skip the
automatic migrations.

### Moving the data off Supabase (one-off)

Torque used to run on Supabase's Postgres and Supabase Auth. To bring an existing
database across to a plain Postgres:

1. Dump the app's tables (the `public` schema, which includes `__EFMigrationsHistory`)
   from Supabase. Use the direct connection string from the project's database
   settings, not the pooler:

   ```bash
   pg_dump "$SUPABASE_DB_URL" --schema=public --data-only --no-owner --no-acl -f torque-data.sql
   ```

2. On the new database, build the schema up to the last migration before the auth
   switch, load the data, then apply the rest:

   ```bash
   dotnet ef database update AddAppSettings     # schema only, as of the Supabase days
   psql "$NEW_DB_URL" -c 'TRUNCATE "__EFMigrationsHistory"'
   psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f torque-data.sql
   dotnet ef database update                    # applies ReplaceSupabaseAuth
   ```

   `ReplaceSupabaseAuth` adds a unique index on `users.hc_user_id` (ignoring empty
   ones). If it fails, two users share an HCA id. Find them with
   `SELECT hc_user_id, count(*) FROM users WHERE hc_user_id <> '' GROUP BY 1 HAVING count(*) > 1`
   and merge or clear the duplicates.

3. Everyone signs in again once (Supabase sessions don't carry over). Sign-in finds
   each existing user by `hc_user_id`, so they keep their id, projects and Volts.
   Until a user signs in again there are no HCA tokens stored for them, so their
   approved ships wait in the Airtable push queue until then.

## Endpoints

"Auth required" means the `torque_session` cookie that `auth/login` sets. Requests
that send that cookie with any method other than GET/HEAD/OPTIONS must also send an
`X-Torque-Request` header (any value), or they get a 403. This stops other sites from
submitting forms with the cookie. The frontend's `apiFetch` adds the header.

| Method | Route | Auth required | Description |
|---|---|---|---|
| GET | `api/health` | No | return JSON |
| GET | `config.js` | No | Docker image only (not `dotnet run`). JavaScript that sets `window.__TORQUE_CONFIG__` to the frontend's runtime config: `apiUrl` (always `""`, same origin). Every other non-`api/`, non-`auth/` path serves the frontend's `index.html` |
| GET | `auth/login` | No | Browser navigation, not `fetch`. Redirects to Hack Club Auth to sign in. Afterwards it sends the browser to `returnTo`: a path on the frontend, or an absolute URL on the frontend's or this API's origin. Defaults to `/home`. Query: `returnTo` (string, optional) |
| GET | `auth/callback` | No | Where HCA redirects back to (handled by the OIDC middleware, not a controller). Creates or updates the user's row, matched by their HCA `sub`; stores their HCA tokens encrypted; sets the `torque_session` HttpOnly cookie; redirects to `returnTo`. On failure (consent denied, HCA down) it redirects to `FRONTEND_URL/?login=failed` |
| POST | `auth/logout` | No | Clears the session cookie. 204 |
| GET | `auth/me` | YES | Who's signed in: `id`, `name`, `email`. 401 when signed out. Works for banned users too |
| GET | `api/user/{id:guid}` | No | Get public profile (no PII) by user ID, including their Slack user ID (for linking to their Slack profile) |
| GET | `api/user/me` | YES | Get authenticated user's own profile, including `timeZone` (streak timezone, null until set) `streakFreezes` (read-only; everyone starts with 3) and `completedFirstTimeSetup` (false until `me/onboarding` is called) |
| PUT | `api/user/me/onboarding` | YES | First-time setup: set your username, bio and profile picture, and mark `completedFirstTimeSetup` true. Can be called again to change them (every field is overwritten). 400 on invalid input; 409 if the username is taken (case-insensitive). Body (JSON): `username` (string, required, 3–30 chars: letters, numbers, `_`, `-`), `bio` (string, optional, max 500), `profilePictureUrl` (http(s) URL, optional — omitted/`""` clears it) |
| PUT | `api/user/me/timezone` | YES | Set the timezone streak days are counted in (12 AM–12 AM local). One-time only: 409 once set — after that only an admin can change it. Body (JSON): `timeZone` (IANA id, e.g. `America/New_York`, required) |
| GET | `api/admin/user/search` | YES | Admin-only. Search users by username, name, email, Slack ID or Hackatime/HC id (or an exact user id), newest first, capped at 50. No `q` lists the newest users. Each row: `id`, `username`, `name`, `email`, `profilePictureUrl`, `slackUserID`, `role`, `volts`, `watchlisted`, `createdAt`. Query: `q` (string, optional) |
| GET | `api/admin/user/{id:guid}` | YES | Admin-only. Everything about a user: profile, `email`, `internalNote`, `watchlisted`, `country`, `timeZone`, `streakFreezes`, `hackatimeLinked` (the token itself is never exposed), `role`, `banned`, Slack/HC/Hackatime ids, eligibility/verification and `completedFirstTimeSetup` |
| PATCH | `api/admin/user/{id:guid}` | YES | Admin-only. Edit a user's internal note, watchlist flag and streak freezes; returns the user as in `GET api/admin/user/{id}`. Body (JSON): `internalNote` (string, max 5000, `""` clears), `watchlisted` (bool), `streakFreezes` (int 0–100) — all optional, at least one required |
| POST | `api/admin/user/{id:guid}/ban` | YES | Admin-only. Ban/unban a user (a `banned` entry in `role`; a banned user gets 403 everywhere except `api/user/me/banned`). 400 when banning yourself. Returns the user. Body (JSON): `banned` (bool, required) |
| PUT | `api/admin/user/{id:guid}/roles` | YES | Admin-only. Replace a user's staff roles; a ban is kept as is. 400 for an unknown role or removing your own admin. Returns the user. Body (JSON): `roles` (string[] of `admin`/`reviewer`, required; `[]` removes every role) |
| PATCH | `api/admin/user/{id:guid}/timezone` | YES | Admin-only. Change a user's streak timezone. Body (JSON): `timeZone` (IANA id, required) |
| GET | `api/user/volts/history` | YES | Get the authenticated user's Volts balance (`volts`) and ledger `entries` (ship payouts, admin adjustments and shop orders: `amount` (signed), `kind` (`ship_payout`\|`admin_adjustment`\|`shop_purchase`\|`shop_refund`), `reason`, `shipmentId`, `orderId`, `createdByUserId`, `createdAt`), newest first |
| GET | `api/admin/user/{id:guid}/volts/history` | YES | Admin-only. Same as `api/user/volts/history`, for any user |
| POST | `api/admin/user/{id:guid}/volts` | YES | Admin-only. Manually credit/debit a user's Volts: writes an `admin_adjustment` ledger entry and returns the new balance. 400 if it would take the balance below 0. Body (JSON): `amount` (int, required, non-zero — negative debits), `reason` (string, required, max 500) |
| GET | `api/user/me/banned` | YES | Get whether the authenticated user is currently banned: `banned`, and `reason` (`hackatime` = their linked Hackatime account is red, so it's the Fraud Squad's call\|`other` = any other ban\|null when not banned). Reachable even while banned — unlike every other endpoint, which returns 403 for a banned user |
| GET | `api/project/{id:guid}` | No | Get a project by ID. Project responses include `voltsGranted`, `coverImageUrl` (null when the owner hasn't set one), `streak` (daily streak, capped at the level's max), `maxStreak` and `grantStatus` (`None`\|`Pending`\|`Fulfilled` — the build grant from an approved design ship). The streak is paused while the project is in review (`Unreviewed`/`Claimed`/`Fraud_Pending`): no missed days are settled, and the days in review are forgiven once it leaves |
| GET | `api/project/{id:guid}/streak` | No | Get a project's daily streak: `streak`, `maxStreak` (15/25/23/19 days for levels 1–4), `multiplier` (1 + 0.01 × streak), `lastStreakDate`, `freezesPaused`, and the last 60 recorded `days` (`Pending` = under 1h journaled, `Completed`, or `Frozen` = covered by a streak freeze), newest first |
| POST | `api/project/{id:guid}/streak/freezes` | YES | Pause/resume spending the owner's streak freezes on one of their own projects (403 otherwise). While paused, a missed day resets that project's streak instead of using a freeze, saving them for the owner's other projects. Returns the project, with `streakFreezesPaused`. Body (JSON): `paused` (bool, required) |
| GET | `api/project/staff-picks` | No | Get staff-picked projects (any status), newest first. Same shape as `api/project/{id}`, plus `ownerUsername` |
| GET | `api/project/search` | No | Search all unarchived projects (any status) by title/description, title matches ranked first, capped at 25. Each row: `id`, `title`, `description`, `tier`, `ownerUserId`, `ownerUsername`, `coverImageUrl`, `totalHours`, `voltsGranted`, `status`, `createdAt`. Query: `q` (string, required) |
| GET | `api/project/leaderboard/hours` | No | Get the top 50 approved projects by tracked hours, descending. Each row: `id`, `title`, `ownerUserId`, `ownerUsername`, `coverImageUrl`, `totalHoursRaw`, `voltsGranted` |
| GET | `api/project/leaderboard/volts` | No | Get the top 50 approved projects by volts granted, descending. Each row: `id`, `title`, `ownerUserId`, `ownerUsername`, `coverImageUrl`, `totalHoursRaw`, `voltsGranted` |
| GET | `api/project/user/{id:guid}` | No | Get a user's projects (public view, any status), newest first |
| GET | `api/project/me` | YES | Get the authenticated user's own projects |
| POST | `api/project/create` | YES | Create a new project, owned by the authenticated user. 503 `{ error, paused }` while `project_creation_paused` is on (see `api/settings`). 400 if a repo/demo/readme URL or Hackatime project name is already used by another project. Body (JSON): `title` (string, required, max 200), `tier` (int 1–4, required — the project's level), `description` (string, optional, max 5000), `aiUse` (string, optional, max 2000 — how AI was used), `repoUrl`, `demoUrl`, `readmeUrl`, `coverImageUrl` (http(s) URLs, optional; `coverImageUrl` is the image shown at the top of the project page and isn't duplicate-checked), `hackatimeProjectNames` (string[], optional) |
| PATCH | `api/project/{id:guid}` | YES | Edit one of the authenticated user's own projects (403 otherwise). Omitted/null fields are left unchanged; `""` clears an optional text field. 409 while the project is archived or in review (`Unreviewed`/`Claimed`/`Fraud_Pending`), or when changing `tier` after one of its ships got final approval (only a reviewer's `overrideTier` can change it then). Same validation and duplicate checks as `create`. Changing `hackatimeProjectNames` replaces the whole list and keeps already-credited journal time as is: unlinking a project doesn't stall tracking, and time logged on a newly linked project before it was linked isn't credited (503 if Hackatime can't be reached to work this out). Body (JSON): `title`, `description`, `tier`, `aiUse`, `repoUrl`, `demoUrl`, `readmeUrl`, `coverImageUrl`, `hackatimeProjectNames` — all optional, at least one required |
| POST | `api/project/{id:guid}/archive` | YES | Archive/unarchive one of the authenticated user's own projects (403 otherwise). An archived project is hidden from search and can't be edited, journaled on or shipped until unarchived; it still shows up everywhere else with `isArchived: true` (and `archivedAt`). Archiving resets the project's streak to 0 (so no freezes are spent on it); 409 while the project is in review. Body (JSON): `isArchived` (bool, required) |
| GET | `api/admin/project/search` | YES | Admin-only. Search every project (any status, archived too) by title, project/owner id or owner username, newest first, capped at 50. Each row: `id`, `title`, `ownerUserId`, `ownerUsername`, `status`, `tier`, `totalHours`, `totalHoursApproved`, `voltsGranted`, `grantStatus`, `isArchived`, `isStaffPick`, `coverImageUrl`, `createdAt`. Query (all optional): `q`, `status` (`Unshipped`\|`Unreviewed`\|`Claimed`\|`Fraud_Pending`\|`Changes_Needed`\|`Approved`\|`Perm_Rejected`), `ownerId`, `archived` (bool) |
| GET | `api/admin/project/{id:guid}` | YES | Admin-only. Everything about a project, private fields included: `ownerUsername`, `hackatimeProjectNames`, `journalCount`, `claimedByReviewer`/`claimedByUsername`/`claimedAt`, design/build/total/approved hours, `voltsGranted`, `grantStatus`, `exceptional`, `isStaffPick`, archive state, `streak`/`maxStreak`/`lastStreakDate`/`streakFreezesPaused` |
| PATCH | `api/admin/project/{id:guid}` | YES | Admin-only. Override a project's level (allowed even after a final-approved ship; the streak is capped to the new level's max), archive/unarchive it (409 while in review; archiving drops the streak) or set `exceptional`. Returns the project as in `GET api/admin/project/{id}`. Body (JSON): `tier` (int 1–4), `isArchived` (bool), `exceptional` (bool) — all optional, at least one required |
| POST | `api/admin/project/{id:guid}/staff-pick` | YES | Admin-only. Mark/unmark a project as a staff pick. Body (JSON): `isStaffPick` (bool, required) |
| GET | `api/devlog/{id:guid}` | No | Get a devlog by ID |
| GET | `api/devlog/me` | YES | Get the authenticated user's own devlogs, newest first, capped at 30 |
| GET | `api/devlog/user/{id:guid}` | No | Get a user's devlogs, newest first, capped at 30 |
| POST | `api/devlog/batch` | No | Get up to 30 devlogs at once. Body (JSON): `ids` (string[], required, max 30) — feed it a project's `devlogIds` |
| GET | `api/devlog/preview/{projectId:guid}` | YES | Preview what a journal posted now would credit on one of your own projects (403 otherwise), without posting it: `trackedHours` (Hackatime time on the linked names since the last journal, capped at `maxHours` = 10), `uncappedHours` (anything above `trackedHours` is forfeited when the journal is posted), `hackatimeLinked`, `hackatimeReachable`. Rate-limited to 15/min per user |
| POST | `api/devlog/create` | YES | Create a new devlog on one of the authenticated user's own projects (403 otherwise; 503 `{ error, paused }` while `journaling_paused` is on) and append its id to the project's `devlogIds`. `text` is markdown with photos embedded inline (`![alt](url)`): it needs at least 150 characters of writing (image markdown doesn't count), at most 10,000 characters in all (photo links included), and at least one photo, from the text or `imageUrls` (400 otherwise). 503 if the project has linked Hackatime names but Hackatime can't be reached (or isn't connected), so the time can't be credited. Two journals posted at once on the same project are handled one after the other, so the same Hackatime time is never credited twice. Embedded photo links are merged into the stored `imageUrls`. Records `trackedHours`: the project's Hackatime time since the previous devlog, capped at 10h (any extra is forfeited, not carried over to the next devlog). The same time is added to the project's raw total hours (`totalHours` / `totalHoursRaw`). Then updates the project's streak: the day (in the owner's timezone) counts once its devlogs cover 1h+. Missed days are settled by a background worker, using a streak freeze per missed day or resetting the streak. The owner gets a Slack DM when a freeze is used, the streak resets or it reaches the level's max streak. Body (JSON): `projectId` (guid string, required), `title` (string, required, max 120), `text` (markdown string, required, max 10,000), `imageUrls` (http(s) string[], optional) |
| GET | `api/ships/get/me` | YES | Get the authenticated user's own shipments, newest first, including reviewer feedback. `approvedHours`, `paidHours`, `voltsPerHour` and `voltsGranted` stay 0 until the ship's final approval (`finalApprovedAt`) |
| GET | `api/ships/window/{projectId:guid}` | YES | Owner-only (403 otherwise, 404 for no such project). Whether the project can send each kind of ship given Torque's deadlines (US Eastern: design ships through Nov 30, build ships through Dec 30): `{ design, build }`, each `{ open, closesAt, lateFixUntil }`. Past a kind's deadline it's `open` only as a late fix: the project is `Changes_Needed`, its latest ship is that kind and was sent before the deadline, and it's within 3 days of that review; `lateFixUntil` is then when the one resubmission must be sent by. Doesn't check status, hours or pauses (`api/ships/create` does) |
| GET | `api/ships/get/{id:guid}` | YES | Get a shipment by ID (public view) |
| POST | `api/ships/create` | YES | Ship (submit for review) a project owned by the authenticated user. 503 `{ error, paused }` while `ships_paused` is on, or `resubmissions_paused` for a `Changes_Needed` project. 403 `{ error, code }` unless the shipper's Hack Club identity is verified and YSWS-eligible (`code`: `identity_unverified`\|`identity_pending`\|`ysws_ineligible`; HCA is re-checked live first, so a just-verified user isn't held up by the 15-minute sync). The linked Hackatime account's trust is re-checked too: if Hackatime has marked it red since it was linked, the account is banned and it's 403 `{ error, code: "banned" }` (if Hackatime can't be asked, the ship goes through). Allowed while the project is `Unshipped`, `Changes_Needed` or `Approved` (so an approved project can keep shipping), and only with at least 1 hour of journaled time no final-approved ship has credited yet (400 otherwise). A design ship can ask for at most $5 per hour being shipped (`requestedFunding` ≤ floor(unpaid hours × 5), 400 otherwise; bigger grants are special cases arranged by hand). 403 `{ error, code: "ships_closed" }` once that kind of ship has closed (design ships after Nov 30, all ships after Dec 30, US Eastern), except for one late fix within 3 days of a "changes needed"/rejected review of a ship sent before the deadline (see `api/ships/window/{projectId}`). A build ship (`isBuildComplete: true`) gets 409 while the project's `grantStatus` is `Pending` (the design ship's grant hasn't been sent yet). Two ships sent at once for the same project are handled one after the other, so only the first goes through. Design vs build is always the shipper's choice (`isBuildComplete`), never inferred. Snapshots the project's tier and unpaid journal hours (`hourSnapshot` — journaled hours not yet credited by a final-approved ship) and flips it to `Unreviewed`, pausing its streak. Body (JSON): `projectId` (guid string, required), `isBuildComplete` (bool, required — `false` = design ship, `true` = build ship), `requestedFunding` (int >= 0, required), `howDidYouHear`, `whatAreWeDoingWell`, `howCanWeImprove` (strings, required, max 400 each) |
| GET | `api/admin/ships` | YES | Admin-only. Look up ships, newest first, capped at 50. `q` matches a ship/project/user id, the project title or the shipper's username. Each row: `id`, `projectId`, `projectTitle`, `userId`, `username`, `status`, `isBuildComplete`, `hourSnapshot`, `approvedHours`, `voltsGranted`, `requestedFunding`, `pushedToAirtable`, `finalApprovedAt`, `createdAt`. Query (all optional): `q`, `status` (`unreviewed`\|`approved`\|`rejected`\|`perm_rejected`\|`needs_changes`), `userId`, `projectId` |
| GET | `api/admin/ships/{id:guid}` | YES | Admin-only. One ship with everything: the reviewer view (hours, overrides, payout, `feedback`, `reviewerNote`, the shipper's survey answers, `projectSnapshot`) plus `projectTitle`, `username`, `airtableRecordId`, `airtablePushedAt` and every review it got (`reviews`, newest first, with internal notes and `reviewerUsername`) |
| GET | `api/admin/review/get/pending` | YES | Reviewer-only. Get shipments awaiting review (`Unreviewed`), oldest first |
| GET | `api/admin/review/get/{id:guid}` | YES | Reviewer-only. Get a single shipment by ID (reviewer view) |
| POST | `api/admin/review/create` | YES | Reviewer-only. Review an `Unreviewed` shipment (approve/reject/perm_reject/changes_needed) — the first pass. Approving credits and pays nothing: it keeps `overrideHours`/`overrideTier` on the shipment for the final approval, flips the project to `Fraud_Pending` (and sets `Exceptional` if requested), and a background worker pushes the shipment once to Airtable, where approving the record calls `api/airtable/approve`. `perm_rejected` flips the project to the terminal `Perm_Rejected` (not reshippable); otherwise to `Changes_Needed`. Either ends the review, so the streak resumes. 400 if approving and the project has no level 1–4 and no `overrideTier`; 409 if someone reviewed it at the same moment. Body (JSON): `shipmentId` (guid, required), `status` (`approved`\|`rejected`\|`perm_rejected`\|`changes_needed`, required — `returned` not yet supported), `feedback`, `internalNote`, `overrideJustification`, `deflationJustification`, `additionalJustification` (strings, optional), `screenshotUrl` (http(s) URL) + `technicalFeatures` (string) — optional, but required when approving, `hideReviewerName`, `exceptional` (bool, optional), `returnedBy` (guid, optional), `overrideHours` (float >= 0, optional — approval only; requires `overrideJustification`), `overrideTier` (int 1–4, optional — approval only; also sets the project's level) |
| POST | `api/airtable/approve` | Secret | 503 `{ error, paused }` while `payouts_paused` is on (re-run the automation afterwards). Called by the Airtable automation when a shipment's record is approved — the ship's final approval (fraud review, second pass). No login token works here: the only auth is the `X-Webhook-Secret` header (= `AIRTABLE_WEBHOOK_SECRET`). Rate-limited to 60/min per IP. Credits `approvedHours` (`overrideHours` if sent, else the reviewer's override, else the shipment's `hourSnapshot`), then pays out: a build ship gets Volts for every credited hour not yet paid or covered by a grant (grant $ ÷ 5) × the project's level/streak rate, floored, into the Volts ledger; a design ship that requested funding gets a grant of `requestedFunding`, capped at $5 per approved hour (project `grantStatus` → `Pending`). The project moves `Fraud_Pending` → `Approved` and its streak resumes. Safe to call twice (the repeat returns `alreadyApproved: true` and pays nothing). Response: `shipmentId`, `projectId`, `projectStatus`, `grantStatus`, `approvedHours`, `voltsPerHour`, `voltsPaid`, `grantId`, `alreadyApproved`, `finalApprovedAt`. 400 bad body; 401 bad/missing secret; 404 no such shipment; 409 the shipment isn't awaiting final approval (or the project has no level 1–4); 429 rate-limited; 503 secret not configured. Body (JSON): `shipmentId` (guid, required — the Airtable "Torque Ship ID" column), `overrideHours` (float >= 0, optional) |
| GET | `api/slack/channels` | YES | The Slack channel IDs `channels/join` adds you to (`SLACK_JOIN_CHANNELS`). Response: `channelIds` |
| POST | `api/slack/channels/join` | YES | Invite the signed-in user to every channel in `SLACK_JOIN_CHANNELS`. No body: it only ever uses your own Slack ID (from your account), so you can't add anyone else. Response: `results` — one `{ channelId, status }` per channel, `status` `Joined`\|`AlreadyMember`\|`Failed`. 400 if your account has no Slack ID; 429 over 5/min; 503 if Slack or the channel list isn't configured |
| GET | `api/admin/grants` | YES | Admin-only. List build grants (created when a design ship that requested funding gets its final approval), oldest first: `amount` (USD), project/user, `fulfilled`, `fulfilledByUserId`, `fulfilledAt`, `note`. Query: `fulfilled` (bool, optional filter) |
| PATCH | `api/admin/grants/{id:guid}` | YES | Admin-only. Tick/untick a grant as fulfilled (the money is sent manually). Ticking records the admin as fulfiller and sets the project's `grantStatus` to `Fulfilled` (unlocking the build ship); unticking sets it back to `Pending`. Body (JSON): `fulfilled` (bool, required), `note` (string, optional, max 2000) |
| POST | `api/hackatime/start` | YES | Generates a Hackatime OAuth authorize URL and a `state` value the caller must hold onto and echo back in `callback`. Rate-limited to 10/min per user. 503 if `HACKATIME_CLIENT_ID`/`SECRET` aren't set |
| POST | `api/hackatime/callback` | YES | Completes the Hackatime OAuth flow: verifies `state`, exchanges `code` for a token, and stores the connection (encrypted) on the authenticated user. 403 (and bans the account) if the linked Hackatime account has `trust_level: red`; 502 (nothing is linked) if Hackatime can't be asked, since an account is never linked without that check. Rate-limited to 10/min per user. Body (JSON): `code`, `state`, `storedState` (all strings, required) |
| GET | `api/hackatime/status` | YES | Whether the authenticated user currently has a Hackatime account connected. Rate-limited to 15/min per user |
| GET | `api/hackatime/projects` | YES | Get the authenticated user's Hackatime project names (for linking to a Torque project). Rate-limited to 15/min per user |
| POST | `api/hackatime/hours` | YES | Get all-time hours (+ per-project breakdown) for a set of the authenticated user's linked Hackatime project names. Rate-limited to 15/min per user. Body (JSON): `projectNames` (string[], required) |
| GET | `api/admin/project/{id:guid}/lapse` | YES | Reviewers and admins. Get lapse.hackclub.com timelapses for a project's owner, filtered to the project's linked Hackatime project names |
| GET | `api/announcement` | No | Get the latest 30 announcements, newest first. `body` is markdown (rendered by the frontend); `updatedAt` is null unless edited |
| GET | `api/announcement/{id:guid}` | No | Get an announcement by ID |
| POST | `api/admin/announcement/create` | YES | Admin-only. Post an announcement. Body (JSON): `title` (string, required, max 200), `body` (markdown string, required, max 20000) |
| PATCH | `api/admin/announcement/{id:guid}` | YES | Admin-only. Edit an announcement and stamp `updatedAt`. Body (JSON): `title`, `body` (strings, optional — omitted fields are left unchanged, at least one required) |
| DELETE | `api/admin/announcement/{id:guid}` | YES | Admin-only. Delete an announcement. 204 on success |
| GET | `api/settings` | No | Get every global setting, keyed by name: `{ "ships_paused": { paused, message }, ... }`. `message` is the admin's custom text or the default (what builders should be shown while it's on). Settings: `ships_paused` (blocks `api/ships/create`), `resubmissions_paused` (blocks shipping a `Changes_Needed` project; first ships still go through), `project_creation_paused` (blocks `api/project/create`), `journaling_paused` (blocks `api/devlog/create` and pauses streaks), `streaks_paused` (missed streak days aren't settled — no resets, no freezes spent — and the paused days are forgiven when it's switched off), `payouts_paused` (the Airtable push worker holds approved ships so no final approvals, Volts or grants happen; they go out when resumed, and `api/airtable/approve` answers 503 meanwhile), `shop_paused` (blocks `api/shop/purchase`; the shop stays browsable and orders can still be fulfilled or refunded). A paused endpoint answers **503** `{ error, paused }`: `error` is the message, `paused` the setting's name |
| GET | `api/admin/settings` | YES | Admin-only. Every setting with `key`, `label`, `description`, `paused`, `message` (what's shown), `customMessage` (null = using `defaultMessage`), `defaultMessage`, `updatedAt` and `updatedByUserId` |
| PATCH | `api/admin/settings/{key}` | YES | Admin-only. Switch a setting on/off and/or change its message; returns the setting as in `api/admin/settings`. 404 for an unknown key. Switching off the last of `streaks_paused`/`journaling_paused` forgives every active streak's paused days. Body (JSON): `paused` (bool), `message` (string, max 500; `""` goes back to the default) — both optional, at least one required |
| GET | `api/shop` | YES | The shop, priced for the caller's region: `unlockedTier` (highest level among their final-approved ships, 0 = none; unlocks that level and below), `region` (`US`\|`CA`\|`EU`\|`UK`\|`IN`\|`AU`\|`XX`, from their Hack Club Auth address country), `volts`, `closesAt` (when the shop closes for good: the end of Jan 6, 2027 US Eastern, as UTC) and `closed`, `daily` (`{ date, endsAt, item }` — today's random item, rotating at 12 AM US Eastern; anyone can buy it whatever their level; null when nothing is eligible) and `tiers` (levels 1–4: `{ tier, unlocked, items }`). Each item: `id`, `name`, `description`, `imageUrl`, `tier`, `price` (cheapest option's when it has variants), `stock` (null = unlimited), `maxPerUser`, `owned`, `randomMode` (`eligible`\|`random_only`\|`never`), `regions`, `variants` (`id`, `name`, `price`, `stock`), `unavailableReason` (null = buyable, else `random_only`\|`locked_tier`\|`region_unavailable`\|`out_of_stock`\|`limit_reached`\|`insufficient_volts`) and `unavailableMessage`. `random_only` items only appear as the daily item |
| GET | `api/shop/marquee` | No | Up to 40 active items as `{ name, imageUrl, tier, description, price, hasOptions }` (base-region price, lowest option; no stock), for the landing page's shop cards |
| GET | `api/shop/address` | YES | The caller's shipping address, read live from Hack Club Auth, for the checkout's confirm step: `address` (`name`, `line1`, `line2`, `city`, `state`, `postalCode`, `country`, `region`; null when they haven't added one there), `region`, `editUrl` (Hack Club Auth, where they change it). 401 `hca_revoked` if HCA no longer accepts their sign-in, 502 `hca_unreachable` if HCA is down |
| POST | `api/shop/purchase` | YES | Buy an item. The price is worked out server-side from the address's region (re-read from HCA and copied onto the order) and the chosen variant; Volts are debited and stock decremented atomically. Retrying with the same `clientRequestId` returns the first order instead of buying twice. DMs the buyer on Slack. Returns `{ order, volts }` (order as in `api/shop/orders`). Errors are `{ error, code }`: 400 `no_address`\|`variant_required`, 403 `shop_closed` (after Jan 6, 2027 US Eastern)\|`identity_unverified`\|`identity_pending`\|`ysws_ineligible` (as in `api/ships/create`)\|`random_only`\|`locked_tier`\|`region_unavailable`\|`inactive`, 409 `out_of_stock`\|`limit_reached`\|`insufficient_volts`\|`daily_rotated`. 503 while `shop_paused` is on. Rate-limited to 10/min per user. Body (JSON): `itemId` (uuid, required), `variantId` (uuid, required when the item has variants), `quantity` (int, 1–10, default 1), `addressConfirmed` (bool, must be true), `note` (string, optional, max 500), `clientRequestId` (uuid, required) |
| GET | `api/shop/orders` | YES | The caller's orders, newest first: `id`, `shopItemId`, `itemName`, `variantName`, `imageUrl`, `quantity`, `unitPrice`, `totalPrice`, `viaDaily`, `status` (`pending`\|`fulfilled`\|`refunded`), `trackingReference`, `userNote`, `createdAt`, `fulfilledAt`, `refundedAt` |
| POST | `api/shop/orders/{id:guid}/cancel` | YES | Cancel one of your own orders that hasn't shipped yet: refunds its Volts (a `shop_refund` ledger entry) and puts the stock back. Returns `{ order, volts }`. 409 `not_refundable` once it's shipped or refunded |
| GET | `api/admin/shop/items` | YES | Admin-only. Every item (active or not) by level then `sortOrder`: `id`, `name`, `description`, `imageUrl`, `tier`, `price`, `regions`, `regionalPrices` (region → price), `stock`, `maxPerUser`, `randomMode`, `isActive`, `sortOrder`, `fulfillerNotes`, `variants` (`id`, `name`, `priceDelta`, `stock`, `isActive`, `sortOrder`), `sold` (units across non-refunded orders), `createdAt`, `updatedAt` |
| GET | `api/admin/shop/items/{id:guid}` | YES | Admin-only. One item, as in `api/admin/shop/items` |
| POST | `api/admin/shop/items` | YES | Admin-only. Create an item; returns it as in `api/admin/shop/items`. Body (JSON): `name` (string, required, max 120), `description` (max 2000), `imageUrl` (http(s)), `tier` (1–4, required), `price` (Volts, 0–1,000,000, required), `regions` (required, non-empty: any of `US`, `CA`, `EU`, `UK`, `IN`, `AU`, `XX`), `regionalPrices` (object, region → price, regions must be in `regions`), `stock` (null = unlimited; ignored when it has variants), `maxPerUser` (null = no limit), `randomMode` (`eligible` (default)\|`random_only`\|`never`), `isActive` (default true), `sortOrder`, `fulfillerNotes` (staff-only, max 2000), `variants` (array, max 50: `name` (required, unique, max 80), `priceDelta` (Volts added to the regional price), `stock`, `isActive`, `sortOrder`) |
| POST | `api/admin/shop/items/bulk` | YES | Admin-only. Create up to 200 items at once. Body (JSON): an array of item bodies as in `POST api/admin/shop/items`. All or nothing: if any row is invalid, nothing is added and the 400 is `{ error, rows: [{ index, name, error }] }` |
| PUT | `api/admin/shop/items/{id:guid}` | YES | Admin-only. Replace an item (send every field; missing optional ones are cleared). Same body as `POST api/admin/shop/items`; variants with an `id` are kept and updated, ones without are added, unlisted ones are deleted |
| DELETE | `api/admin/shop/items/{id:guid}` | YES | Admin-only. Delete an item nobody has ordered; one with orders is deactivated instead. Returns `{ deleted, deactivated }` |
| GET | `api/admin/shop/daily` | YES | Admin-only. Today's daily item (rolled now if nobody has opened the shop yet) and recent picks: `{ today, endsAt, current, picks: [{ date, itemId, itemName, setByUserId, createdAt }] }`. Query: `days` (1–90, default 14) |
| PUT | `api/admin/shop/daily/today` | YES | Admin-only. Set today's daily item, or reroll it at random (skipping the current one) when `itemId` is left out; returns the same shape as `api/admin/shop/daily`. Body (JSON): `itemId` (uuid, optional, must be an active item) |
| GET | `api/admin/shop/orders` | YES | Admin-only. The fulfilment queue (max 200): `id`, `userId`, `username`, `itemName`, `variantName`, `imageUrl`, `quantity`, `unitPrice`, `totalPrice`, `region`, `viaDaily`, `status`, `userNote`, `trackingReference`, `adminNote`, `fulfilledAt`, `refundedAt`, `createdAt`. Query: `status` (`pending` (default)\|`fulfilled`\|`refunded`\|`all`), `itemId`, `userId`, `sort` (`oldest` (default)\|`newest`) |
| GET | `api/admin/shop/orders/{id:guid}` | YES | Admin-only. One order with the buyer's `userEmail`/`userSlackId`, the item's `fulfillerNotes`, and the shipping `address` they confirmed at checkout |
| POST | `api/admin/shop/orders/{id:guid}/fulfill` | YES | Admin-only. Mark a pending order shipped and DM the buyer (with tracking, if given). 409 `not_pending` otherwise. Body (JSON): `trackingReference` (string, optional, max 500), `note` (string, optional, staff-only, max 2000) |
| POST | `api/admin/shop/orders/{id:guid}/refund` | YES | Admin-only. Refund a pending or shipped order: Volts back to the buyer (`shop_refund` ledger entry), stock back only if it hadn't shipped, and a DM with the reason. 409 `not_refundable` if already refunded. Body (JSON): `reason` (string, required, max 2000) |
| POST | `api/upload/image` | YES | Upload one image to the S3/R2 bucket and get back `{ url }` to put in `coverImageUrl`, a journal's markdown, a shop item's `imageUrl` or an announcement body. Body (multipart form): `file` (PNG, JPEG, GIF or WebP, max 10 MB — the type is checked from the file's bytes, not its name), `purpose` (`cover`\|`journal`, or admin-only `shop`\|`announcement`). 400 not an image / bad purpose, 413 too large, 429 over 30 uploads a minute, 503 when the `S3_*` vars aren't set |
