# Torque Backend

The backend for Torque written in C#.

## Instructions

1. Get supabase and write most recent migration
2. Copy example.env and rename it .env and put in all your env vars
3. Run dotnet watch

## Testing

**DISCLAIMER:** This part was done using AI

`./testing/run.sh` brings up Supabase and the backend, and serves a test harness at
<http://localhost:5267/testing/> that signs in over OIDC and sends authenticated
requests to every endpoint below. See [testing/README.md](testing/README.md).

## Endpoints

| Method | Route | Auth required | Description |
|---|---|---|---|
| GET | `api/health` | No | return JSON |
| GET | `api/user/{id:guid}` | No | Get public profile (no PII) by user ID |
| GET | `api/user/me` | YES | Get authenticated user's own profile |
| GET | `api/project/{id:guid}` | No | Get a project by ID |
| GET | `api/project/me` | YES | Get the authenticated user's own projects |
| POST | `api/project/create` | YES | Create a new project, owned by the authenticated user. Body (JSON): `title` (string, required), `description` (string, optional) |
| GET | `api/devlog/{id:guid}` | No | Get a devlog by ID |
| GET | `api/devlog/me` | YES | Get the authenticated user's own devlogs, newest first, capped at 30 |
| POST | `api/devlog/batch` | No | Get up to 30 devlogs at once. Body (JSON): `ids` (string[], required, max 30) — feed it a project's `devlogIds` |
| POST | `api/devlog/create` | YES | Create a new devlog, owned by the authenticated user, and appends its id to the owning project's `devlogIds`. Body (JSON): `projectId` (guid string, required), `title` (string, required), `text` (string, required), `imageUrls` (string[], optional) |
| GET | `api/ships/get/me` | YES | Get the authenticated user's own shipments |
| GET | `api/ships/get/{id:guid}` | YES | Get a shipment by ID (public view) |
| POST | `api/ships/create` | YES | Ship (submit for review) a project owned by the authenticated user. Only allowed while the project is `Unshipped` or `Changes_Needed`; snapshots the project's current hours/tier and flips it to `Unreviewed`. Body (JSON): `projectId` (guid string, required) |
| GET | `api/admin/review/get/pending` | YES | Reviewer-only. Get shipments awaiting review (`Unreviewed`), oldest first |
| GET | `api/admin/review/get/{id:guid}` | YES | Reviewer-only. Get a single shipment by ID (reviewer view) |
| POST | `api/admin/review/create` | YES | Reviewer-only. Review an `Unreviewed` shipment (approve/reject/perm_reject/changes_needed). Reviewer cannot review their own shipment. On approval flips the project to `Approved` (and sets `Exceptional` if requested); `perm_rejected` flips it to the terminal `Perm_Rejected` (not reshippable); otherwise to `Changes_Needed`. Body (JSON): `shipmentId` (guid, required), `status` (`approved`\|`rejected`\|`perm_rejected`\|`changes_needed`, required — `returned` not yet supported), `feedback`, `internalNote`, `overrideJustification` (strings, optional), `hideReviewerName`, `exceptional` (bool, optional), `returnedBy` (guid, optional) |
