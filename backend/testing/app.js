// Torque API test harness.
// Served by the backend itself in Development (see modules/testing/TestingExtension.cs),
// so every request below is same-origin and needs no CORS.

const $ = (id) => document.getElementById(id);

let sb = null;                 // the Supabase client (window.supabase is the library itself)
let session = null;
let config = null;

// Mirrors the endpoint table in backend/README.md.
// `auth: true` means the action carries [Authorize].
const ENDPOINTS = [
  {
    id: 'health',
    method: 'GET',
    path: '/api/health',
    auth: false,
    desc: 'Liveness plus a database round-trip. 503 when the db is unreachable.',
  },
  {
    id: 'user-by-id',
    method: 'GET',
    path: '/api/user/{id}',
    auth: false,
    desc: 'Public profile, no PII. 404 when no such user.',
    params: [{ name: 'id', placeholder: 'user uuid' }],
  },
  {
    id: 'user-me',
    method: 'GET',
    path: '/api/user/me',
    auth: true,
    desc: "The signed-in user's own profile, keyed off the token's `sub` claim.",
  },
  {
    id: 'project-by-id',
    method: 'GET',
    path: '/api/project/{id}',
    auth: false,
    desc: 'A single project. 404 when no such project.',
    params: [{ name: 'id', placeholder: 'project uuid' }],
  },
  {
    id: 'project-create',
    method: 'POST',
    path: '/api/project/create',
    auth: true,
    desc: 'Creates a project owned by the signed-in user. 400 when title is blank.',
    body: { title: 'Test project', description: 'created from the harness' },
  },
];

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
  $('endpoints').innerHTML = '';

  for (const ep of ENDPOINTS) {
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

    const authLabel = document.createElement('label');
    authLabel.className = 'check';
    authLabel.innerHTML = `<input type="checkbox" id="a-${ep.id}" ${ep.auth ? 'checked' : ''}> auth`;

    const send = document.createElement('button');
    send.className = 'primary';
    send.textContent = 'Send';
    send.addEventListener('click', () => sendEndpoint(ep));

    actions.append(authLabel, send);
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

    $('endpoints').append(wrap);
  }
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

  send({ method: ep.method, path, body, auth: $(`a-${ep.id}`).checked, endpointId: ep.id });
}

// ---------------------------------------------------------------- requests

async function send({ method, path, body, auth, endpointId }) {
  const label = `${method} ${path}`;

  const headers = {};
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
