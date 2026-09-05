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
