// Torque API test harness.
// Served by the backend itself in Development (see modules/testing/TestingExtension.cs),
// so every request below is same-origin and needs no CORS.

const $ = (id) => document.getElementById(id);

let sb = null;                 // the Supabase client (window.supabase is the library itself)
let session = null;
let config = null;

// Mirrors the endpoint table in backend/README.md.
// `auth: true` means the action carries [Authorize].
// `group` maps 1:1 to the backend module (modules/<group>) and drives the section headings below.
const ENDPOINTS = [
  {
    id: 'health',
    group: 'misc',
    method: 'GET',
    path: '/api/health',
    auth: false,
    desc: 'Liveness plus a database round-trip. 503 when the db is unreachable.',
  },
  {
    id: 'user-by-id',
    group: 'users',
    method: 'GET',
    path: '/api/user/{id}',
    auth: false,
    desc: 'Public profile, no PII (includes slackUserID). 404 when no such user.',
    params: [{ name: 'id', placeholder: 'user uuid' }],
  },
  {
    id: 'user-me',
    group: 'users',
    method: 'GET',
    path: '/api/user/me',
    auth: true,
    desc: "The signed-in user's own profile, keyed off the token's `sub` claim.",
  },
  {
    id: 'user-volts-history',
    group: 'users',
    method: 'GET',
    path: '/api/user/volts/history',
    auth: true,
    desc: "The signed-in user's Volts balance and ledger entries (ship payouts, admin adjustments), newest first.",
  },
  {
    id: 'user-me-banned',
    group: 'users',
    method: 'GET',
    path: '/api/user/me/banned',
    auth: true,
    desc: 'Whether the signed-in user is currently banned. Reachable even while banned — every other endpoint 403s for a banned user.',
  },
  {
    id: 'user-set-timezone',
    group: 'users',
    method: 'PUT',
    path: '/api/user/me/timezone',
    auth: true,
    desc: 'Set your streak timezone (IANA id). One-time only: 409 once set. 400 for an unknown timezone.',
    body: {
      timeZone: 'America/New_York',
    },
  },
  {
    id: 'admin-user-timezone',
    group: 'users',
    method: 'PATCH',
    path: '/api/admin/user/{id}/timezone',
    auth: true,
    desc: "Admin-only. Change a user's streak timezone. 403 unless the signed-in user has the admin role.",
    params: [{ name: 'id', placeholder: 'user uuid' }],
    body: {
      timeZone: 'Europe/London',
    },
  },
  {
    id: 'admin-user-volts-history',
    group: 'users',
    method: 'GET',
    path: '/api/admin/user/{id}/volts/history',
    auth: true,
    desc: "Admin-only. Any user's Volts balance and ledger entries, newest first.",
    params: [{ name: 'id', placeholder: 'user uuid' }],
  },
  {
    id: 'admin-user-volts-adjust',
    group: 'users',
    method: 'POST',
    path: '/api/admin/user/{id}/volts',
    auth: true,
    desc: "Admin-only. Credit (positive amount) or debit (negative) a user's Volts with a reason; writes an admin_adjustment ledger entry and returns the new balance. 400 if amount is 0, reason is missing, or it would take the balance below 0.",
    params: [{ name: 'id', placeholder: 'user uuid' }],
    body: {
      amount: 100,
      reason: 'Manual correction',
    },
  },
  {
    id: 'project-by-id',
    group: 'projects',
    method: 'GET',
    path: '/api/project/{id}',
    auth: false,
    desc: 'A single project. 404 when no such project.',
    params: [{ name: 'id', placeholder: 'project uuid' }],
  },
  {
    id: 'project-staff-picks',
    group: 'projects',
    method: 'GET',
    path: '/api/project/staff-picks',
    auth: false,
    desc: 'Staff-picked projects (any status), newest first.',
  },
  {
    id: 'project-search',
    group: 'projects',
    method: 'GET',
    path: '/api/project/search?q={q}',
    auth: false,
    desc: 'Search all projects (any status) by title/description. Title matches ranked first, capped at 25.',
    params: [{ name: 'q', placeholder: 'search text' }],
  },
  {
    id: 'project-leaderboard-hours',
    group: 'projects',
    method: 'GET',
    path: '/api/project/leaderboard/hours',
    auth: false,
    desc: 'Top 50 approved projects by tracked hours, descending.',
  },
  {
    id: 'project-leaderboard-volts',
    group: 'projects',
    method: 'GET',
    path: '/api/project/leaderboard/volts',
    auth: false,
    desc: 'Top 50 approved projects by volts granted, descending.',
  },
  {
    id: 'project-by-user',
    group: 'projects',
    method: 'GET',
    path: '/api/project/user/{id}',
    auth: false,
    desc: "A user's projects (public view, any status), newest first. Empty array for an unknown user.",
    params: [{ name: 'id', placeholder: 'user uuid' }],
  },
  {
    id: 'project-me',
    group: 'projects',
    method: 'GET',
    path: '/api/project/me',
    auth: true,
    desc: "The signed-in user's own projects.",
  },
  {
    id: 'project-create',
    group: 'projects',
    method: 'POST',
    path: '/api/project/create',
    auth: true,
    desc: 'Creates a project owned by the signed-in user. 400 when title is blank.',
    body: {
      title: 'Test project',
      description: 'created from the harness',
      tier: 0,
      repoUrl: 'https://github.com/example/repo',
      demoUrl: 'https://example.com/demo',
      readmeUrl: 'https://github.com/example/repo#readme',
      hackatimeProjectNames: ['my-project'],
    },
  },
  {
    id: 'project-staff-pick-set',
    group: 'projects',
    method: 'POST',
    path: '/api/admin/project/{id}/staff-pick',
    auth: true,
    desc: 'Admin-only. Mark/unmark a project as a staff pick. 403 unless the signed-in user has the admin role.',
    params: [{ name: 'id', placeholder: 'project uuid' }],
    body: {
      isStaffPick: true,
    },
  },
  {
    id: 'project-streak',
    group: 'streaks',
    method: 'GET',
    path: '/api/project/{id}/streak',
    auth: false,
    desc: "A project's daily streak, max streak, multiplier and last 60 days (Pending / Completed / Frozen).",
    params: [{ name: 'id', placeholder: 'project uuid' }],
  },
  {
    id: 'streaks-simulate',
    group: 'streaks',
    method: 'POST',
    path: '/testing/streaks/simulate',
    auth: true,
    desc: 'Dev-only playground. hours = hours journaled per day, oldest first, last entry = today (0 = missed day). Replays them through the real streak code (backdated journals, worker settle after each day) and returns a day-by-day timeline. Uses your timezone. Rolled back afterwards unless keep is true. This preset shows a completed run, a freeze, a reset and an under-1h day.',
    body: {
      tier: 1,
      freezes: 1,
      hours: [2, 1.5, 0, 3, 0, 0, 1, 0.5, 2],
      keep: false,
    },
  },
  {
    id: 'streaks-simulate-cap',
    group: 'streaks',
    method: 'POST',
    path: '/testing/streaks/simulate',
    auth: true,
    desc: 'Same playground, preset to hit the cap: 18 days of 1.5h on a level 1 project stops at a 15-day streak (40 Volts/hr). Change tier to see 25 / 23 / 19.',
    body: {
      tier: 1,
      freezes: 3,
      hours: Array(18).fill(1.5),
      keep: false,
    },
  },
  {
    id: 'streaks-settle',
    group: 'streaks',
    method: 'POST',
    path: '/testing/streaks/settle',
    auth: true,
    desc: 'Dev-only. Runs the streak worker pass now: projects that missed a day spend a freeze or reset. Set a project\'s last_streak_date back in Studio first to simulate missed days.',
  },
  {
    id: 'devlog-by-id',
    group: 'devlogs',
    method: 'GET',
    path: '/api/devlog/{id}',
    auth: false,
    desc: 'A single devlog. 404 when no such devlog.',
    params: [{ name: 'id', placeholder: 'devlog uuid' }],
  },
  {
    id: 'devlog-me',
    group: 'devlogs',
    method: 'GET',
    path: '/api/devlog/me',
    auth: true,
    desc: "The signed-in user's own devlogs, newest first. Capped at 30.",
  },
  {
    id: 'devlog-by-user',
    group: 'devlogs',
    method: 'GET',
    path: '/api/devlog/user/{id}',
    auth: false,
    desc: "A user's devlogs, newest first. Capped at 30. Empty array for an unknown user.",
    params: [{ name: 'id', placeholder: 'user uuid' }],
  },
  {
    id: 'devlog-batch',
    group: 'devlogs',
    method: 'POST',
    path: '/api/devlog/batch',
    auth: false,
    desc: 'Fetch up to 30 devlogs by id at once — feed it a project\'s devlogIds. 400 if more than 30 ids or any id is malformed.',
    body: {
      ids: [],
    },
  },
  {
    id: 'devlog-create',
    group: 'devlogs',
    method: 'POST',
    path: '/api/devlog/create',
    auth: true,
    desc: 'Creates a devlog on one of your projects (403 otherwise). trackedHours = Hackatime time since the previous devlog, max 10. Updates the project streak once the day reaches 1h. 400 when title/projectId/text is blank.',
    body: {
      projectId: '00000000-0000-0000-0000-000000000000',
      title: 'Test devlog',
      text: 'created from the harness',
      imageUrls: [],
    },
  },
  {
    id: 'ships-me',
    group: 'ships',
    method: 'GET',
    path: '/api/ships/get/me',
    auth: true,
    desc: "The signed-in user's own shipments.",
  },
  {
    id: 'ships-by-id',
    group: 'ships',
    method: 'GET',
    path: '/api/ships/get/{id}',
    auth: true,
    desc: 'A single shipment (public view). 404 when no such shipment.',
    params: [{ name: 'id', placeholder: 'shipment uuid' }],
  },
  {
    id: 'ships-create',
    group: 'ships',
    method: 'POST',
    path: '/api/ships/create',
    auth: true,
    desc: 'Ships a project owned by the signed-in user. 400 unless the project is Unshipped or Changes_Needed, or Approved (unless a build is already approved; a build ship is refused while grantStatus is Pending — design vs build is always your isBuildComplete choice), or if any of isBuildComplete, requestedFunding (>= 0) or the three feedback answers are missing. Pauses the project\'s streak until the review ends.',
    body: {
      projectId: '00000000-0000-0000-0000-000000000000',
      isBuildComplete: false,
      requestedFunding: 50,
      howDidYouHear: 'Slack',
      whatAreWeDoingWell: 'Clear docs',
      howCanWeImprove: 'More examples',
    },
  },
  {
    id: 'review-pending',
    group: 'review',
    method: 'GET',
    path: '/api/admin/review/get/pending',
    auth: true,
    desc: 'Reviewer-only. Shipments awaiting review, oldest first. 403 unless the signed-in user has the reviewer role.',
  },
  {
    id: 'review-by-id',
    group: 'review',
    method: 'GET',
    path: '/api/admin/review/get/{id}',
    auth: true,
    desc: 'Reviewer-only. A single shipment (reviewer view). 404 when no such shipment.',
    params: [{ name: 'id', placeholder: 'shipment uuid' }],
  },
  {
    id: 'review-create',
    group: 'review',
    method: 'POST',
    path: '/api/admin/review/create',
    auth: true,
    desc: 'Reviewer-only. First-pass review of an unreviewed shipment. status is approved | rejected | perm_rejected | changes_needed. 400 if already reviewed, status is "returned" (not supported yet), screenshotUrl isn\'t http(s), approving without screenshotUrl + technicalFeatures, or approving a project with no level 1–4 and no overrideTier. 409 if reviewed at the same moment. Approving credits and pays nothing: it keeps overrideHours (needs overrideJustification) / overrideTier for the final approval, moves the project to Fraud_Pending and the Airtable row is pushed within ~60s; approving that row (airtable-approve) pays out. Any other status ends the review and resumes the streak.',
    body: {
      shipmentId: '00000000-0000-0000-0000-000000000000',
      status: 'approved',
      feedback: 'Nice work!',
      internalNote: '',
      overrideJustification: '',
      screenshotUrl: 'https://placehold.co/800x600.png',
      technicalFeatures: 'Custom motor driver PCB',
      deflationJustification: '',
      additionalJustification: '',
      hideReviewerName: false,
      exceptional: false,
      overrideHours: null,
      overrideTier: null,
    },
  },
  {
    id: 'grants-list',
    group: 'grants',
    method: 'GET',
    path: '/api/admin/grants?fulfilled={fulfilled}',
    auth: true,
    desc: 'Admin-only. Build grants (created when the Airtable record of a design ship that requested funding is approved), oldest first. fulfilled filters to true/false; leave blank for all.',
    params: [{ name: 'fulfilled', placeholder: 'false' }],
  },
  {
    id: 'grants-update',
    group: 'grants',
    method: 'PATCH',
    path: '/api/admin/grants/{id}',
    auth: true,
    desc: "Admin-only. Tick/untick a grant as fulfilled. Ticking records you as fulfiller and sets the project's grantStatus to Fulfilled, so the build can be shipped; unticking sets it back to Pending.",
    params: [{ name: 'id', placeholder: 'grant uuid' }],
    body: {
      fulfilled: true,
      note: 'Sent via HCB',
    },
  },
  {
    id: 'airtable-approve',
    group: 'airtable',
    method: 'POST',
    path: '/api/airtable/approve',
    auth: false,
    desc: 'What the Airtable automation calls when a record is approved: the ship\'s final approval. No login works here (leave auth unticked); the only auth is the X-Webhook-Secret header (AIRTABLE_WEBHOOK_SECRET). Credits overrideHours (optional) or the reviewer\'s override or the shipped hourSnapshot, then pays a build ship\'s Volts or creates a design ship\'s grant (grantStatus Pending), and moves the project Fraud_Pending → Approved. Repeat calls return alreadyApproved: true. 401 bad secret, 404 unknown shipment, 409 not awaiting final approval, 429 rate-limited, 503 secret not set.',
    headers: [{ name: 'X-Webhook-Secret', placeholder: 'AIRTABLE_WEBHOOK_SECRET' }],
    body: {
      shipmentId: '00000000-0000-0000-0000-000000000000',
      overrideHours: null,
    },
  },
  {
    id: 'ship-flow',
    group: 'review',
    method: 'FLOW',
    path: 'project → ship → review → Airtable',
    auth: true,
    bundle: true,
    buttonLabel: 'Run',
    desc: 'End-to-end ship test as the signed-in user (needs the reviewer role): creates a project from `project` below (a unique suffix is added to the title and URLs so reruns never collide), ships it with `ship`, reviews the shipment with `review`, then forces an Airtable push pass via the dev-only /testing/airtable/push route and reports the record id. Stops at the first failing step. hackatimeProjectNames must be unused by other projects.',
    body: {
      project: {
        title: 'Airtable flow test',
        description: 'created by the ship-flow bundle',
        tier: 1,
        repoUrl: 'https://github.com/example/torque-test',
        demoUrl: 'https://example.com/torque-test',
        readmeUrl: 'https://github.com/example/torque-test#readme',
        hackatimeProjectNames: [],
      },
      ship: {
        isBuildComplete: false,
        requestedFunding: 50,
        howDidYouHear: 'Slack',
        whatAreWeDoingWell: 'ship-flow bundle',
        howCanWeImprove: 'ship-flow bundle',
      },
      review: {
        status: 'approved',
        feedback: 'Looks good!',
        internalNote: 'ship-flow bundle',
        overrideJustification: '',
        screenshotUrl: 'https://placehold.co/800x600.png',
        technicalFeatures: 'Test run from the harness ship-flow bundle.',
        deflationJustification: '',
        additionalJustification: '',
        hideReviewerName: false,
        exceptional: false,
      },
    },
  },
  {
    id: 'hackatime-login',
    group: 'hackatime',
    method: 'FLOW',
    path: 'start → popup → callback',
    auth: true,
    bundle: true,
    buttonLabel: 'Log in',
    desc: 'One-click login: calls start, opens the authorize page in a popup, and completes callback automatically when Hackatime redirects back to HACKATIME_REDIRECT_URI. Needs that redirect URI pointed at this harness (see backend/.env) and a popup blocker exception.',
  },
  {
    id: 'hackatime-start',
    group: 'hackatime',
    method: 'POST',
    path: '/api/hackatime/start',
    auth: true,
    desc: 'Generates a Hackatime OAuth authorize URL and a state value to hold onto and echo back in callback. 503 if HACKATIME_CLIENT_ID/SECRET are not set.',
  },
  {
    id: 'hackatime-callback',
    group: 'hackatime',
    method: 'POST',
    path: '/api/hackatime/callback',
    auth: true,
    desc: 'Completes the Hackatime OAuth flow. 401 on bad/mismatched state or a failed code exchange. 403 (and bans the account) if the linked Hackatime account has trust_level "red".',
    body: {
      code: '',
      state: '',
      storedState: '',
    },
  },
  {
    id: 'hackatime-status',
    group: 'hackatime',
    method: 'GET',
    path: '/api/hackatime/status',
    auth: true,
    desc: 'Whether the signed-in user currently has a Hackatime account connected.',
  },
  {
    id: 'hackatime-projects',
    group: 'hackatime',
    method: 'GET',
    path: '/api/hackatime/projects',
    auth: true,
    desc: "The signed-in user's Hackatime project names. Empty array if not connected.",
  },
  {
    id: 'hackatime-hours',
    group: 'hackatime',
    method: 'POST',
    path: '/api/hackatime/hours',
    auth: true,
    desc: 'All-time hours + per-project breakdown for the given linked Hackatime project names.',
    body: {
      projectNames: ['my-project'],
    },
  },
  {
    id: 'lapse-project',
    group: 'lapse',
    method: 'GET',
    path: '/api/admin/project/{id}/lapse',
    auth: true,
    desc: "Reviewer-only. lapse.hackclub.com timelapses for a project's owner, filtered to the project's linked Hackatime project names. 403 unless the signed-in user has the reviewer role.",
    params: [{ name: 'id', placeholder: 'project uuid' }],
  },
  {
    id: 'announcement-latest',
    group: 'announcements',
    method: 'GET',
    path: '/api/announcement',
    auth: false,
    desc: 'Latest 30 announcements, newest first. body is markdown.',
  },
  {
    id: 'announcement-by-id',
    group: 'announcements',
    method: 'GET',
    path: '/api/announcement/{id}',
    auth: false,
    desc: 'A single announcement.',
    params: [{ name: 'id', placeholder: 'announcement uuid' }],
  },
  {
    id: 'announcement-create',
    group: 'announcements',
    method: 'POST',
    path: '/api/admin/announcement/create',
    auth: true,
    desc: 'Admin-only. Post an announcement. title max 200, body (markdown) max 20000. 403 unless the signed-in user has the admin role.',
    body: {
      title: 'Hello from Torque',
      body: '## What\'s new\n\n- **Bold** item\n- A [link](https://hackclub.com)',
    },
  },
  {
    id: 'announcement-update',
    group: 'announcements',
    method: 'PATCH',
    path: '/api/admin/announcement/{id}',
    auth: true,
    desc: 'Admin-only. Edit title and/or body; omitted fields are left unchanged. Stamps updatedAt.',
    params: [{ name: 'id', placeholder: 'announcement uuid' }],
    body: {
      title: 'Edited title',
    },
  },
  {
    id: 'announcement-delete',
    group: 'announcements',
    method: 'DELETE',
    path: '/api/admin/announcement/{id}',
    auth: true,
    desc: 'Admin-only. Delete an announcement. 204 on success.',
    params: [{ name: 'id', placeholder: 'announcement uuid' }],
  },
];

// Display order and labels for the groups above.
const GROUP_LABELS = {
  misc: 'Misc',
  users: 'Users',
  projects: 'Projects',
  streaks: 'Streaks',
  devlogs: 'Devlogs',
  ships: 'Ships',
  review: 'Review',
  grants: 'Grants',
  airtable: 'Airtable',
  hackatime: 'Hackatime',
  lapse: 'Lapse',
  announcements: 'Announcements',
};

// ---------------------------------------------------------------- boot

async function boot() {
  renderEndpoints();
  wireStaticHandlers();

  try {
    const res = await fetch('/testing/config');
    if (!res.ok) throw new Error(`/testing/config returned ${res.status}`);
    config = await res.json();
  } catch (err) {
    setPill('pill-config', 'config · failed', 'err');
    showAuthError(
      `Could not load /testing/config: ${err.message}. Is the backend running in Development?`
    );
    return;
  }

  const missing = ['supabaseUrl', 'supabaseAnonKey', 'oidcProvider'].filter((k) => !config[k]);
  if (missing.length) {
    setPill('pill-config', 'config · incomplete', 'err');
    showAuthError(`Missing from backend/.env: ${missing.join(', ')}`);
    return;
  }

  setPill('pill-config', 'config · loaded', 'ok');
  $('auth-provider-line').textContent = `${config.oidcProvider} via ${config.supabaseUrl}`;
  $('btn-signin').textContent = `Sign in with ${config.oidcProvider.replace(/^custom:/, '')}`;

  sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  // PKCE: supabase-js exchanges the ?code= on load, then we tidy the URL.
  sb.auth.onAuthStateChange((_event, next) => {
    session = next;
    renderAuth();
  });
  const { data } = await sb.auth.getSession();
  session = data.session;
  renderAuth();

  if (new URLSearchParams(location.search).has('code')) {
    history.replaceState(null, '', location.pathname);
  }

  pingBackend();
}

async function pingBackend() {
  try {
    const res = await fetch('/api/health');
    const body = await res.json().catch(() => null);
    const ok = res.ok && body?.status === 'ok';
    setPill('pill-backend', `backend · ${body?.db ?? res.status}`, ok ? 'ok' : 'err');
  } catch {
    setPill('pill-backend', 'backend · unreachable', 'err');
  }
}

// ---------------------------------------------------------------- auth

function renderAuth() {
  const signedIn = !!session;
  $('btn-signin').disabled = signedIn;
  $('btn-refresh').disabled = !signedIn;
  $('btn-signout').disabled = !signedIn;
  $('auth-details').hidden = !signedIn;
  $('auth-raw').hidden = !signedIn;
  $('auth-user-raw').hidden = !signedIn;

  if (!signedIn) {
    setPill('pill-auth', 'auth · signed out');
    return;
  }

  const claims = decodeJwt(session.access_token);
  setPill('pill-auth', `auth · ${session.user.email ?? session.user.id.slice(0, 8)}`, 'ok');
  $('auth-sub').textContent = session.user.id;
  $('auth-email').textContent = session.user.email ?? '(none)';
  $('auth-jwt').textContent = JSON.stringify(claims, null, 2);
  $('auth-user').textContent = JSON.stringify(session.user, null, 2);

  const expiresAt = new Date((session.expires_at ?? 0) * 1000);
  const mins = Math.round((expiresAt - Date.now()) / 60000);
  $('auth-exp').textContent =
    mins > 0 ? `${expiresAt.toLocaleTimeString()} (in ${mins} min)` : 'expired — refresh the session';
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(payload))));
  } catch {
    return { error: 'could not decode token' };
  }
}

async function signIn() {
  hideAuthError();
  const { error } = await sb.auth.signInWithOAuth({
    provider: config.oidcProvider,
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) showAuthError(`Sign-in failed: ${error.message}`);
}

async function refreshSession() {
  const { error } = await sb.auth.refreshSession();
  if (error) showAuthError(`Refresh failed: ${error.message}`);
  else hideAuthError();
}

function showAuthError(msg) {
  const el = $('auth-error');
  el.textContent = msg;
  el.hidden = false;
}
function hideAuthError() { $('auth-error').hidden = true; }

// ---------------------------------------------------------------- endpoints UI

function renderEndpoints() {
  const root = $('endpoints');
  root.innerHTML = '';

  const groups = new Map();
  for (const ep of ENDPOINTS) {
    if (!groups.has(ep.group)) groups.set(ep.group, []);
    groups.get(ep.group).push(ep);
  }

  for (const [group, eps] of groups) {
    const card = document.createElement('details');
    card.className = 'card';
    card.open = true;

    const summary = document.createElement('summary');
    summary.innerHTML = `
      <h2>${GROUP_LABELS[group] ?? group}</h2>
      <span class="ep-count">${eps.length}</span>`;
    card.append(summary);

    const list = document.createElement('div');
    list.className = 'ep-list';
    for (const ep of eps) list.append(buildEndpointRow(ep));
    card.append(list);

    root.append(card);
  }
}

function buildEndpointRow(ep) {
  const wrap = document.createElement('div');
  wrap.className = 'ep';

  const head = document.createElement('div');
  head.className = 'ep-head';
  head.innerHTML = `
    <span class="method ${ep.method}">${ep.method}</span>
    <span class="ep-path">${ep.path}</span>
    ${ep.auth ? '<span class="lock">requires auth</span>' : ''}`;

  const actions = document.createElement('div');
  actions.className = 'ep-actions';

  for (const p of ep.params ?? []) {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `p-${ep.id}-${p.name}`;
    input.placeholder = p.placeholder;
    input.size = 36;
    input.spellcheck = false;
    actions.append(input);
  }

  // Request headers the endpoint needs (e.g. a webhook secret); sent only when filled in.
  for (const h of ep.headers ?? []) {
    const input = document.createElement('input');
    input.type = 'password';
    input.id = `h-${ep.id}-${h.name}`;
    input.placeholder = h.placeholder;
    input.size = 36;
    input.autocomplete = 'off';
    actions.append(input);
  }

  const send = document.createElement('button');
  send.className = 'primary';

  if (ep.bundle) {
    // A bundle drives multiple requests (plus a popup redirect) under one click,
    // so there's no single auth checkbox or body to show — it always uses the
    // signed-in session.
    send.textContent = ep.buttonLabel ?? 'Run';
    send.addEventListener('click', () => runBundle(ep));
    actions.append(send);
  } else {
    const authLabel = document.createElement('label');
    authLabel.className = 'check';
    authLabel.innerHTML = `<input type="checkbox" id="a-${ep.id}" ${ep.auth ? 'checked' : ''}> auth`;

    send.textContent = 'Send';
    send.addEventListener('click', () => sendEndpoint(ep));
    actions.append(authLabel, send);
  }
  head.append(actions);
  wrap.append(head);

  const desc = document.createElement('div');
  desc.className = 'ep-desc';
  desc.textContent = ep.desc;
  wrap.append(desc);

  if (ep.body) {
    const ta = document.createElement('textarea');
    ta.id = `b-${ep.id}`;
    ta.rows = 5;
    ta.spellcheck = false;
    ta.value = JSON.stringify(ep.body, null, 2);
    wrap.append(ta);
  }

  return wrap;
}

function sendEndpoint(ep) {
  let path = ep.path;
  for (const p of ep.params ?? []) {
    const value = $(`p-${ep.id}-${p.name}`).value.trim();
    if (!value) return renderError(`${ep.method} ${ep.path}`, `Path parameter "${p.name}" is empty.`);
    path = path.replace(`{${p.name}}`, encodeURIComponent(value));
  }

  let body;
  if (ep.body) {
    const raw = $(`b-${ep.id}`).value.trim();
    if (raw) {
      try {
        JSON.parse(raw);
      } catch (err) {
        return renderError(`${ep.method} ${path}`, `Request body is not valid JSON: ${err.message}`);
      }
      body = raw;
    }
  }

  const headers = {};
  for (const h of ep.headers ?? []) {
    const value = $(`h-${ep.id}-${h.name}`).value.trim();
    if (value) headers[h.name] = value;
  }

  send({ method: ep.method, path, body, auth: $(`a-${ep.id}`).checked, endpointId: ep.id, headers });
}

// ---------------------------------------------------------------- bundles

function runBundle(ep) {
  if (ep.id === 'hackatime-login') return loginToHackatime();
  if (ep.id === 'ship-flow') return runShipFlow(ep);
  return renderError(ep.id, `Unknown bundle "${ep.id}".`);
}

// One authenticated JSON request as a bundle step: shows up in the response panel and
// history like a normal call. Returns the parsed body, or null (after rendering the
// failing response) so the caller can stop.
async function bundleStep(method, path, body) {
  const label = `${method} ${path}`;
  const headers = { Authorization: `Bearer ${session.access_token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const started = performance.now();
  let res, text;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    text = await res.text();
  } catch (err) {
    renderError(label, `Network error: ${err.message}`);
    return null;
  }
  const ms = Math.round(performance.now() - started);
  const parsed = safeJson(text);

  renderResponse({ label, status: res.status, ms, headers: res.headers, text, parsed });
  addHistory({ label, status: res.status, ms, text, parsed, headers: res.headers });
  return res.ok ? (parsed ?? {}) : null;
}

async function runShipFlow(ep) {
  const label = 'Ship → review → Airtable';
  if (!session) return renderError(label, 'Not signed in — sign in first.');

  let input;
  try {
    input = JSON.parse($(`b-${ep.id}`).value);
  } catch (err) {
    return renderError(label, `Body is not valid JSON: ${err.message}`);
  }

  // Project create rejects duplicate repo/demo/readme URLs, so make every run unique.
  const suffix = Date.now().toString(36);
  const project = { ...(input.project ?? {}) };
  project.title = `${project.title ?? 'Airtable flow test'} ${suffix}`;
  for (const key of ['repoUrl', 'demoUrl', 'readmeUrl']) {
    if (!project[key]) continue;
    const [base, hash] = project[key].split('#');
    project[key] = `${base}-${suffix}${hash ? `#${hash}` : ''}`;
  }

  const created = await bundleStep('POST', '/api/project/create', project);
  if (!created?.id) return;

  const shipment = await bundleStep('POST', '/api/ships/create', { ...(input.ship ?? {}), projectId: created.id });
  if (!shipment?.id) return;

  const review = await bundleStep('POST', '/api/admin/review/create', { ...(input.review ?? {}), shipmentId: shipment.id });
  if (!review) return;

  if ((input.review?.status ?? 'approved') !== 'approved') return; // only approvals go to Airtable

  await bundleStep('POST', `/testing/airtable/push/${shipment.id}`);
}

let hackatimeMessageHandler = null;

function cleanupHackatimeListener() {
  if (hackatimeMessageHandler) {
    window.removeEventListener('message', hackatimeMessageHandler);
    hackatimeMessageHandler = null;
  }
}

async function loginToHackatime() {
  const label = 'Hackatime login';
  if (!session) return renderError(label, 'Not signed in — sign in first.');

  cleanupHackatimeListener();

  let start;
  try {
    const res = await fetch('/api/hackatime/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const text = await res.text();
    const parsed = safeJson(text);
    if (!res.ok) {
      renderResponse({ label: 'POST /api/hackatime/start', status: res.status, ms: 0, headers: res.headers, text, parsed });
      return;
    }
    start = parsed;
  } catch (err) {
    return renderError(label, `Network error starting Hackatime OAuth: ${err.message}`);
  }

  if (!start?.url || !start?.state) {
    return renderError(label, 'POST /api/hackatime/start did not return a url/state.');
  }

  const popup = window.open(start.url, 'hackatime-login', 'width=520,height=680');
  if (!popup) return renderError(label, 'Popup blocked — allow popups for this page and try again.');

  const closedPoll = setInterval(() => {
    if (popup.closed && hackatimeMessageHandler) {
      cleanupHackatimeListener();
      clearInterval(closedPoll);
      renderError(label, 'Hackatime popup was closed before completing sign-in.');
    }
  }, 500);

  hackatimeMessageHandler = async (event) => {
    if (event.origin !== location.origin || event.data?.source !== 'hackatime-callback') return;

    cleanupHackatimeListener();
    clearInterval(closedPoll);

    const { code, state: returnedState, error } = event.data;
    if (error) return renderError(label, `Hackatime returned an error: ${error}`);
    if (!code || !returnedState) return renderError(label, 'Hackatime callback was missing code/state.');

    const started = performance.now();
    let res, text;
    try {
      res = await fetch('/api/hackatime/callback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state: returnedState, storedState: start.state }),
      });
      text = await res.text();
    } catch (err) {
      return renderError(label, `Network error completing Hackatime OAuth: ${err.message}`);
    }
    const ms = Math.round(performance.now() - started);
    const parsed = safeJson(text);

    renderResponse({ label: 'POST /api/hackatime/callback', status: res.status, ms, headers: res.headers, text, parsed });
    addHistory({ label, status: res.status, ms, text, parsed, headers: res.headers });
  };

  window.addEventListener('message', hackatimeMessageHandler);
}

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- requests

async function send({ method, path, body, auth, endpointId, headers: extraHeaders }) {
  const label = `${method} ${path}`;

  const headers = { ...extraHeaders };
  if (auth) {
    if (!session) return renderError(label, 'Not signed in — sign in first or untick "auth".');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (body) headers['Content-Type'] = 'application/json';

  const started = performance.now();
  let res, text;
  try {
    res = await fetch(path, { method, headers, body });
    text = await res.text();
  } catch (err) {
    return renderError(label, `Network error: ${err.message}`);
  }
  const ms = Math.round(performance.now() - started);

  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch { /* not JSON, fall back to raw text */ }

  renderResponse({ label, status: res.status, ms, headers: res.headers, text, parsed });
  addHistory({ label, status: res.status, ms, text, parsed, headers: res.headers });

  // A created project's id is immediately useful to the GET /api/project/{id} row.
  if (endpointId === 'project-create' && res.status === 201 && parsed?.id) {
    const target = $('p-project-by-id-id');
    if (target) target.value = parsed.id;
  }

  // Same convenience for devlogs: feed the created id into the GET row, and
  // into the batch row's ids array so it's ready to fetch straight away.
  if (endpointId === 'devlog-create' && res.status === 201 && parsed?.id) {
    const target = $('p-devlog-by-id-id');
    if (target) target.value = parsed.id;

    const batchBody = $('b-devlog-batch');
    if (batchBody) {
      let body;
      try {
        body = JSON.parse(batchBody.value);
      } catch {
        body = { ids: [] };
      }
      body.ids = [...(body.ids ?? []), parsed.id];
      batchBody.value = JSON.stringify(body, null, 2);
    }
  }
}

function renderResponse({ label, status, ms, headers, text, parsed }) {
  $('response-empty').hidden = true;
  $('response').hidden = false;

  const statusEl = $('resp-status');
  statusEl.textContent = status;
  statusEl.className = `status s${String(status)[0]}`;

  $('resp-label').textContent = label;
  $('resp-time').textContent = `${ms} ms`;
  $('resp-body').textContent = parsed ? JSON.stringify(parsed, null, 2) : text || '(empty body)';

  const headerLines = [];
  headers.forEach((v, k) => headerLines.push(`${k}: ${v}`));
  $('resp-headers').textContent = headerLines.sort().join('\n');

  renderHint(label, status);
}

// Explains the results that are confusing the first time you hit them.
function renderHint(label, status) {
  const el = $('resp-hint');
  el.hidden = true;
  el.innerHTML = '';

  if (label.includes('/api/user/me') && status === 404 && session) {
    const claims = decodeJwt(session.access_token);
    const meta = session.user.user_metadata ?? {};
    const sql = seedSql(session.user, claims, meta);
    el.innerHTML =
      '<strong>Expected until the user is provisioned.</strong> The token is valid, but nothing ' +
      'inserts a row into <code>public.users</code> when someone signs in, so ' +
      '<code>_db.Users.FindAsync(sub)</code> comes back empty. Seed one by hand:';
    const pre = document.createElement('pre');
    pre.textContent = sql;
    const copy = document.createElement('button');
    copy.className = 'mini';
    copy.textContent = 'copy SQL';
    copy.addEventListener('click', () => copyText(sql, copy));
    el.append(pre, copy);
    el.hidden = false;
    return;
  }

  if (status === 401) {
    el.textContent =
      'Unauthorized — no valid bearer token reached the endpoint. Check the "auth" tick box, and ' +
      'that the session has not expired (refresh it above).';
    el.hidden = false;
  }
}

function seedSql(user, claims, meta) {
  const q = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;
  const username = meta.preferred_username ?? meta.name ?? (user.email ?? '').split('@')[0] ?? 'tester';
  return [
    'insert into users (id, username, email, bio, name, slack_user_id, verification_status, ysws_eligible, created_at)',
    `values (${q(user.id)}, ${q(username)}, ${q(user.email)}, '', ${q(meta.name)},`,
    `        ${q(meta.slack_id)}, ${meta.verification_status === true || meta.verification_status === 'verified'}, ${meta.ysws_eligible === true}, now())`,
    'on conflict (id) do nothing;',
  ].join('\n');
}

function renderError(label, message) {
  $('response-empty').hidden = true;
  $('response').hidden = false;
  const statusEl = $('resp-status');
  statusEl.textContent = '—';
  statusEl.className = 'status sx';
  $('resp-label').textContent = label;
  $('resp-time').textContent = '';
  $('resp-body').textContent = message;
  $('resp-headers').textContent = '';
  $('resp-hint').hidden = true;
}

// ---------------------------------------------------------------- history

const history_ = [];

function addHistory(entry) {
  history_.unshift({ ...entry, at: new Date() });
  history_.length = Math.min(history_.length, 25);

  const list = $('history');
  list.innerHTML = '';
  history_.forEach((h, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.innerHTML = `
      <span class="h-status s${String(h.status)[0]}">${h.status}</span>
      <span>${h.label}</span>
      <span class="h-time">${h.ms} ms · ${h.at.toLocaleTimeString()}</span>`;
    btn.querySelector('.h-status').classList.add('status');
    btn.addEventListener('click', () => renderResponse(history_[i]));
    li.append(btn);
    list.append(li);
  });
}

// ---------------------------------------------------------------- wiring

function wireStaticHandlers() {
  $('btn-signin').addEventListener('click', signIn);
  $('btn-signout').addEventListener('click', () => sb.auth.signOut());
  $('btn-refresh').addEventListener('click', refreshSession);

  $('btn-copy-token').addEventListener('click', (e) => {
    if (session) copyText(session.access_token, e.target);
  });

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => copyText($(btn.dataset.copy).textContent, btn));
  });

  $('custom-send').addEventListener('click', () => {
    const method = $('custom-method').value;
    const path = $('custom-path').value.trim();
    if (!path) return renderError('custom request', 'Path is empty.');

    let body;
    const raw = $('custom-body').value.trim();
    if (raw && method !== 'GET') {
      try {
        JSON.parse(raw);
      } catch (err) {
        return renderError(`${method} ${path}`, `Request body is not valid JSON: ${err.message}`);
      }
      body = raw;
    }
    send({ method, path, body, auth: $('custom-auth').checked });
  });
}

function setPill(id, text, kind) {
  const el = $(id);
  el.textContent = text;
  el.className = `pill${kind ? ' ' + kind : ''}`;
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = 'copied';
    setTimeout(() => (btn.textContent = original), 1200);
  } catch {
    /* clipboard blocked, nothing useful to do */
  }
}

boot();
