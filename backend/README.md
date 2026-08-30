# Torque Backend

The backend for Torque written in C#.

## Instructions

1. Get supabase and write most recent migration
2. Copy example.env and rename it .env and put in all your env vars
3. Run dotnet watch

## Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `api/health` | return JSON |
| GET | `api/user/{id:guid}` | Get public profile (no PII) by user ID |
| GET | `api/user/me` | Get authenticated user's own profile — not implemented (returns 501, no auth wired up) |
| GET | `api/project/{id:guid}` | Get a project by ID |
| POST | `api/project/create` | Create a new project (owner ID not yet set — auth pending) |
