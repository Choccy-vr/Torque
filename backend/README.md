# Torque Backend

The backend for Torque written in C#.

## Setup (do this once) (Written by Claude)

### 1. Install the tools

| Tool | Why | How |
|---|---|---|
| .NET 10 SDK | Builds and runs the backend | [Download page](https://dotnet.microsoft.com/download) |
| EF Core CLI | Applies database migrations | `dotnet tool install --global dotnet-ef` |
| Docker | Supabase runs locally in Docker containers | [Docker Desktop](https://docs.docker.com/desktop/) or [Docker Engine](https://docs.docker.com/engine/install/) on Linux. Make sure the daemon is running (`docker ps` shouldn't error) |
| Supabase CLI | Runs the local database and auth | [Installing the Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started#installing-the-supabase-cli) |
| Node.js + npm | Only for the [testing harness](#testing) | [nodejs.org](https://nodejs.org) or your package manager |

### 2. Start Supabase

From the **repo root** (where the `supabase/` folder is):

```bash
supabase start
```

The first run downloads the Docker images and takes a few minutes. Later runs
take a few seconds. When it's done, print every value you'll need for `.env`:

```bash
supabase status -o env
```

Supabase Studio (a web UI for the database) is at <http://127.0.0.1:54323>.

### 3. Create `backend/.env`

```bash
cp backend/example.env backend/.env
```

Then fill it in. The backend **won't start** without the required ones.

#### Required

| Variable | What to put | Where it comes from |
|---|---|---|
| `DB_CONNECTION_STRING` | `Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres` | The local Supabase Postgres (`DB_URL` in `supabase status -o env`). Local Postgres has no SSL, so leave out the `SSL Mode`/`Trust Server Certificate` parts from `example.env` |
| `SUPABASE_URL` | `http://127.0.0.1:54321` | `API_URL` in `supabase status -o env` |
| `SUPABASE_JWT_SECRET` | the long secret string | `JWT_SECRET` in `supabase status -o env`. Used to verify users' login tokens |
| `FRONTEND_URL` | `http://localhost:5173` | Where the frontend runs (`npm run dev` in `frontend/` uses port 5173). Only this origin is allowed through CORS |
| `TOKEN_ENCRYPTION_KEY` | a random base64 key | Generate one with `openssl rand -base64 32`. Encrypts stored tokens, so don't change it later or the saved Hackatime connections become unreadable |

#### Needed for the testing harness / Airtable

| Variable | What to put | Where it comes from |
|---|---|---|
| `SUPABASE_ANON_KEY` | a key starting with `eyJ` | `ANON_KEY` in `supabase status -o env` |
| `SUPABASE_SERVICE_ROLE_KEY` | a key starting with `eyJ` | `SERVICE_ROLE_KEY` in `supabase status -o env`. Server-only, never put it in the frontend |
| `TESTING_OIDC_PROVIDER` | `custom:hackclub-auth` | The OIDC provider name configured in Supabase auth |

#### Optional integrations

Leave these blank to switch the feature off. The rest of the backend still works.

| Variable | What to put | Where it comes from |
|---|---|---|
| `HACKATIME_CLIENT_ID`, `HACKATIME_CLIENT_SECRET` | OAuth app credentials | Create an OAuth app on [Hackatime](https://hackatime.hackclub.com). Without these, the `api/hackatime/*` endpoints return 503 |
| `HACKATIME_REDIRECT_URI` | `http://localhost:5267/auth/hackatime/callback` | Must exactly match the redirect URI registered on the Hackatime OAuth app |
| `HACKATIME_BASE_URL` | `https://hackatime.hackclub.com` | Leave as is |
| `LAPSE_PROGRAM_KEY` | program key | Ask a Lapse admin. Lets reviewers see a project's timelapses |
| `LAPSE_BASE_URL` | `https://lapse.hackclub.com` | Leave as is |
| `AIRTABLE_API_KEY` | personal access token (`pat...`) | Create one at [airtable.com/create/tokens](https://airtable.com/create/tokens) with the `data.records:write` scope and access to the base |
| `AIRTABLE_BASE_ID` | `app...` | The `app...` part of the base's URL in Airtable |
| `AIRTABLE_TABLE_NAME` | `YSWS Project Submission` | Name of the table approved projects get pushed to |

### 4. Create the database tables

From `backend/`:

```bash
dotnet ef database update
```

Run this again whenever you pull new migrations (new files in
`backend/Data/Migrations/`).

## Running (every time)

1. Make sure Docker is running, then start Supabase from the **repo root**
   (does nothing if it's already up):

   ```bash
   supabase start
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

To stop: `Ctrl-C` the backend, and `supabase stop` (from the repo root) if you
want to shut the containers down too. Your data is kept between restarts.

## Testing

**DISCLAIMER:** This part was done using AI

`./testing/run.sh` brings up Supabase and the backend, and serves a test harness at
<http://localhost:5267/testing/> that signs in over OIDC and sends authenticated
requests to every endpoint below. See [testing/README.md](testing/README.md).

## Endpoints

| Method | Route | Auth required | Description |
|---|---|---|---|
| GET | `api/health` | No | return JSON |
| GET | `api/user/{id:guid}` | No | Get public profile (no PII) by user ID, including their Slack user ID (for linking to their Slack profile) |
| GET | `api/user/me` | YES | Get authenticated user's own profile |
| GET | `api/user/me/banned` | YES | Get whether the authenticated user is currently banned. Reachable even while banned — unlike every other endpoint, which returns 403 for a banned user |
| GET | `api/project/{id:guid}` | No | Get a project by ID |
| GET | `api/project/staff-picks` | No | Get staff-picked projects (any status), newest first |
| GET | `api/project/search` | No | Search all projects (any status) by title/description, title matches ranked first, capped at 25. Query: `q` (string, required) |
| GET | `api/project/leaderboard/hours` | No | Get the top 50 approved projects by tracked hours, descending |
| GET | `api/project/leaderboard/volts` | No | Get the top 50 approved projects by volts granted, descending |
| GET | `api/project/user/{id:guid}` | No | Get a user's projects (public view, any status), newest first |
| GET | `api/project/me` | YES | Get the authenticated user's own projects |
| POST | `api/project/create` | YES | Create a new project, owned by the authenticated user. Body (JSON): `title` (string, required), `description` (string, optional) |
| POST | `api/admin/project/{id:guid}/staff-pick` | YES | Admin-only. Mark/unmark a project as a staff pick. Body (JSON): `isStaffPick` (bool, required) |
| GET | `api/devlog/{id:guid}` | No | Get a devlog by ID |
| GET | `api/devlog/me` | YES | Get the authenticated user's own devlogs, newest first, capped at 30 |
| GET | `api/devlog/user/{id:guid}` | No | Get a user's devlogs, newest first, capped at 30 |
| POST | `api/devlog/batch` | No | Get up to 30 devlogs at once. Body (JSON): `ids` (string[], required, max 30) — feed it a project's `devlogIds` |
| POST | `api/devlog/create` | YES | Create a new devlog, owned by the authenticated user, and appends its id to the owning project's `devlogIds`. Body (JSON): `projectId` (guid string, required), `title` (string, required), `text` (string, required), `imageUrls` (string[], optional) |
| GET | `api/ships/get/me` | YES | Get the authenticated user's own shipments, newest first, including reviewer feedback |
| GET | `api/ships/get/{id:guid}` | YES | Get a shipment by ID (public view) |
| POST | `api/ships/create` | YES | Ship (submit for review) a project owned by the authenticated user. Only allowed while the project is `Unshipped` or `Changes_Needed`; snapshots the project's current hours/tier and flips it to `Unreviewed`. Body (JSON): `projectId` (guid string, required), `isBuildComplete` (bool, required — `false` = design ship, `true` = build ship), `requestedFunding` (int >= 0, required), `howDidYouHear`, `whatAreWeDoingWell`, `howCanWeImprove` (strings, required) |
| GET | `api/admin/review/get/pending` | YES | Reviewer-only. Get shipments awaiting review (`Unreviewed`), oldest first |
| GET | `api/admin/review/get/{id:guid}` | YES | Reviewer-only. Get a single shipment by ID (reviewer view) |
| POST | `api/admin/review/create` | YES | Reviewer-only. Review an `Unreviewed` shipment (approve/reject/perm_reject/changes_needed). On approval (first pass) flips the project to `Fraud_Pending` (and sets `Exceptional` if requested); a background worker then pushes the shipment once to Airtable (no endpoint — see `modules/airtable`); `perm_rejected` flips it to the terminal `Perm_Rejected` (not reshippable); otherwise to `Changes_Needed`. Body (JSON): `shipmentId` (guid, required), `status` (`approved`\|`rejected`\|`perm_rejected`\|`changes_needed`, required — `returned` not yet supported), `feedback`, `internalNote`, `overrideJustification`, `deflationJustification`, `additionalJustification` (strings, optional), `screenshotUrl` (http(s) URL) + `technicalFeatures` (string) — optional, but required when approving, `hideReviewerName`, `exceptional` (bool, optional), `returnedBy` (guid, optional) |
| POST | `api/hackatime/start` | YES | Generates a Hackatime OAuth authorize URL and a `state` value the caller must hold onto and echo back in `callback`. Rate-limited to 10/min per user. 503 if `HACKATIME_CLIENT_ID`/`SECRET` aren't set |
| POST | `api/hackatime/callback` | YES | Completes the Hackatime OAuth flow: verifies `state`, exchanges `code` for a token, and stores the connection (encrypted) on the authenticated user. 403 (and bans the account) if the linked Hackatime account has `trust_level: red`. Rate-limited to 10/min per user. Body (JSON): `code`, `state`, `storedState` (all strings, required) |
| GET | `api/hackatime/status` | YES | Whether the authenticated user currently has a Hackatime account connected. Rate-limited to 15/min per user |
| GET | `api/hackatime/projects` | YES | Get the authenticated user's Hackatime project names (for linking to a Torque project). Rate-limited to 15/min per user |
| POST | `api/hackatime/hours` | YES | Get all-time hours (+ per-project breakdown) for a set of the authenticated user's linked Hackatime project names. Rate-limited to 15/min per user. Body (JSON): `projectNames` (string[], required) |
| GET | `api/admin/project/{id:guid}/lapse` | YES | Reviewer-only. Get lapse.hackclub.com timelapses for a project's owner, filtered to the project's linked Hackatime project names |
| GET | `api/announcement` | No | Get the latest 30 announcements, newest first. `body` is markdown (rendered by the frontend); `updatedAt` is null unless edited |
| GET | `api/announcement/{id:guid}` | No | Get an announcement by ID |
| POST | `api/admin/announcement/create` | YES | Admin-only. Post an announcement. Body (JSON): `title` (string, required, max 200), `body` (markdown string, required, max 20000) |
| PATCH | `api/admin/announcement/{id:guid}` | YES | Admin-only. Edit an announcement and stamp `updatedAt`. Body (JSON): `title`, `body` (strings, optional — omitted fields are left unchanged, at least one required) |
| DELETE | `api/admin/announcement/{id:guid}` | YES | Admin-only. Delete an announcement. 204 on success |
