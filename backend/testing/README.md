# API test harness

A single page for signing in with Hack Club Auth and firing authenticated
requests at the backend. Served by the backend itself (Development only), so
everything is same-origin and no CORS config is involved.

## Run it

```bash
./backend/testing/run.sh
```

Then open <http://localhost:5267/testing/>.

The script starts the compose Postgres (`db`) if it is down, checks `backend/.env`,
applies migrations, and runs the backend.

## Config

Nothing is hardcoded in the page. It fetches `/testing/config`, which returns:

| Key | Purpose |
|---|---|
| `hcaUrl` | The Hack Club Auth instance sign-in goes through (`HCA_URL`, default `https://auth.hackclub.com`) |
| `csrfHeader` | The header the backend wants on cookie-authenticated writes (`X-Torque-Request`) |

Sign-in is a plain navigation to `/auth/login?returnTo=<this page>`. The backend runs the
OIDC flow and sets an HttpOnly `torque_session` cookie, which the page can't read. It
shows what `GET /auth/me` returns instead. The "auth" tick box on each row decides
whether that cookie is sent.

`/testing/*` is only mapped when `ASPNETCORE_ENVIRONMENT=Development`, so none of
this exists in a production build.

## Adding an endpoint

Append to the `ENDPOINTS` array at the top of `app.js`:

```js
{
  id: 'devlog-create',              // unique, used for element ids
  method: 'POST',
  path: '/api/devlog/{projectId}',  // {name} placeholders become inputs
  auth: true,                       // pre-ticks the auth box
  desc: 'Shown under the row.',
  params: [{ name: 'projectId', placeholder: 'project uuid' }],
  body: { text: 'hello' },          // prefills the JSON body editor
}
```

A query parameter that can be left blank takes `optional: true` (e.g. `path: '/api/admin/ships?q={q}'`, `params: [{ name: 'q', placeholder: '...', optional: true }]`); left empty, its `q={q}` pair is dropped from the URL.

An endpoint that needs a request header (like `airtable-approve`'s webhook secret) can
list it as `headers: [{ name: 'X-Webhook-Secret', placeholder: '...' }]`, which renders a
masked input whose value is sent as that header when filled in.

A multipart upload (like `upload-image`) uses `file: 'file'` (the form field the file goes
in) instead of `body`, plus `form: { purpose: 'cover' }` for any other form fields. That
renders a file picker and a prefilled text input per field, and sends them as `FormData`.

The "Custom request" panel handles anything not worth adding permanently.

## Notes

- Sign-in goes through `http://localhost:5267/auth/callback`, so that has to be a
  redirect URI on the HCA app (see the backend README).
- Signing in creates your `users` row, so `GET /api/user/me` works straight away.
- The Hackatime section's **Log in** row is a bundle, not a raw endpoint call: it runs
  `start`, opens the authorize page in a popup, and completes `callback` automatically
  when Hackatime redirects back. For that to land somewhere, `HACKATIME_REDIRECT_URI`
  in `backend/.env` must point at `http://localhost:5267/auth/hackatime/callback` — a
  small dev-only page (`modules/testing/TestingExtension.cs`) that relays the `code`/
  `state` back to the harness tab via `postMessage`, then closes itself.
- The Review section's **project → ship → review → Airtable** row is also a bundle: it
  creates a project (unique suffix on title/URLs), ships it with the `ship` body, reviews
  it with the `review` body, then calls the dev-only `POST /testing/airtable/push/{shipmentId}`
  (`modules/testing/TestingExtension.cs`), which runs an Airtable push pass immediately
  and reports whether the shipment got a record id. Point `AIRTABLE_TABLE_NAME` at a test
  table first — this creates real rows.
- The Streaks section's **settle** row calls the dev-only `POST /testing/streaks/settle`
  (`modules/testing/TestingExtension.cs`), which runs the streak worker pass immediately
  instead of waiting up to 15 min, including its Slack DMs (freeze used / streak lost, and
  the evening reminder for owners past 8 PM local). To simulate missed days, set a project's
  `last_streak_date` back a few days in the database first (`psql` or any Postgres client).
- The Streaks section's **simulate** rows (`POST /testing/streaks/simulate`) are the
  easy way to test streaks: give an `hours` array (one entry per day, oldest first, last
  = today, `0` = missed) plus `tier`, `freezes` and optionally `freezesPaused` (missed
  days reset instead of freezing), and it replays those days through the
  real streak code using backdated journals (no Hackatime needed), settling each day as
  the worker would. It returns a day-by-day timeline showing streak, freezes left and
  outcome. Everything is rolled back afterwards unless `keep: true`.
- The Slack section's **test DM** row calls the dev-only `POST /testing/slack/dm`
  (`modules/testing/SlackTesting.cs`), which sends one of the real DM templates
  (`welcome`, `shipped`, `approved`, `changes_needed`, `rejected`, and the streak ones with
  sample numbers: `streak_at_risk`, `streak_freeze_used`, `streak_lost`, `streak_maxed`) to **your own** Slack ID
  and reports whether Slack accepted it. Needs `SLACK_BOT_TOKEN` in `backend/.env`.
- The Shop section's **test purchase** row (`POST /testing/shop/purchase`,
  `modules/testing/ShopTesting.cs`) runs the real purchase code with a fake address in
  `country` instead of reading your Hack Club Auth address, as you or any `userId`, so you
  can try level locks, regions, variants and limits without an HCA address. Fire it several
  times at once to check stock and Volts can't oversell. **test daily** pins (or rerolls)
  a day's random item.
