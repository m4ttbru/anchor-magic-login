// Shows a small "Log in with Anchor" card on WordPress login pages for sites in your Anchor account.
// Works on wp-login.php and on custom login URLs (WPS Hide Login, etc.), because those still
// render WordPress's standard login form: <body class="login"> with <form id="loginform">.
// On every other page this script checks two things in the DOM and stops — it doesn't contact anything.
(() => {
  // The popup asks this when you open it on one of your sites, to hide the login button
  // if you're already logged in. WordPress marks logged-in pages with <body class="logged-in">
  // and the admin bar on the front end, and <body class="wp-admin …"> inside wp-admin.
  // Only the extension itself can send this message; web pages can't.
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== 'wpState' || sender.id !== chrome.runtime.id) return;
    const b = document.body;
    reply({
      loggedIn: !!(b && (b.classList.contains('logged-in') || b.classList.contains('wp-admin'))) ||
        !!document.getElementById('wpadminbar')
    });
  });

  const isStandard = /\/wp-login\.php$/i.test(location.pathname);
  const hasWpForm = !!document.getElementById('loginform') &&
    !!document.body && document.body.classList.contains('login');
  if (!isStandard && !hasWpForm) return;

  const action = new URLSearchParams(location.search).get('action');
  if (action && action !== 'login') return; // skip logout, lost password, register, etc.
  if (isStandard && !hasWpForm && document.getElementById('lostpasswordform')) return;
  if (document.getElementById('anchor-magic-login-host')) return;

  chrome.runtime.sendMessage({ type: 'lookup' }, r => {
    if (chrome.runtime.lastError || !r || !r.ok || !r.data) return;
    show(r.data);
  });

  function show(match) {
    const host = document.createElement('div');
    host.id = 'anchor-magic-login-host';
    host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });

    root.innerHTML = `
      <style>
        :host { all: initial; }
        .card {
          font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          width: 260px; padding: 14px; border-radius: 12px;
          background: #0f172a; color: #e2e8f0;
          box-shadow: 0 10px 30px rgba(0,0,0,.35); border: 1px solid #1e293b;
          animation: in .18s ease-out;
        }
        @keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .head { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; }
        .head .t { flex: 1; font-weight: 600; letter-spacing: .02em; }
        .x { all: unset; cursor: pointer; font-size: 18px; line-height: 1; color: #64748b; padding: 0 2px; }
        .x:hover { color: #e2e8f0; }
        .name { margin: 6px 0 12px; font-weight: 600; font-size: 15px; color: #fff; word-break: break-word; }
        .env { font-weight: 500; color: #fbbf24; font-size: 12px; margin-left: 4px; }
        .go {
          all: unset; box-sizing: border-box; display: block; width: 100%; text-align: center;
          padding: 9px 12px; border-radius: 8px; cursor: pointer; font-weight: 600;
          background: #2563eb; color: #fff;
        }
        .go:hover { background: #1d4ed8; }
        .go[disabled] { opacity: .7; cursor: default; }
        .err { color: #fca5a5; font-size: 12px; margin-top: 8px; display: none; }
        .kbd { font-size: 11px; color: #64748b; margin-top: 8px; text-align: center; }
      </style>
      <div class="card" role="dialog" aria-label="Anchor magic login">
        <div class="head"><span>⚓</span><span class="t">Anchor Hosting</span><button class="x" title="Dismiss" aria-label="Dismiss">×</button></div>
        <div class="name"></div>
        <button class="go">Log in with magic link</button>
        <div class="err"></div>
      </div>`;

    const nameEl = root.querySelector('.name');
    nameEl.textContent = match.name;
    if (match.env === 'staging') {
      const tag = document.createElement('span');
      tag.className = 'env';
      tag.textContent = 'staging';
      nameEl.appendChild(tag);
    }

    const go = root.querySelector('.go');
    const err = root.querySelector('.err');
    root.querySelector('.x').addEventListener('click', () => host.remove());

    go.addEventListener('click', () => {
      go.disabled = true;
      go.textContent = 'Getting link…';
      err.style.display = 'none';
      chrome.runtime.sendMessage({ type: 'magic' }, r => {
        if (!chrome.runtime.lastError && r && r.ok) {
          go.textContent = 'Logging in…';
          location.href = r.data;
          return;
        }
        go.disabled = false;
        go.textContent = 'Try again';
        err.textContent = (r && r.error) || 'Could not get a login link.';
        err.style.display = 'block';
      });
    });

    document.documentElement.appendChild(host);
  }
})();
