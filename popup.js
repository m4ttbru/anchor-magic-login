const $ = s => document.querySelector(s);
const DASHBOARD = 'https://anchor.host/account/';
const README = 'https://github.com/m4ttbru/anchor-magic-login';
const SETUP_URL = `${README}#2-connect-your-anchor-account`;
const HELP_URL = `${README}#13-troubleshooting`;

let sites = [];
let byId = new Map();
let pins = new Set();
let recent = [];
let view = 'all';      // 'all' | 'recent'
let items = [];        // site rows currently shown, in order (for arrow keys)
let sel = 0;           // index into items
let tab = null;
let match = null;
let updated = 0;
let latestCore = '';

const ICON_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';
const ICON_PIN_FILLED = ICON_PIN.replace('fill="none"', 'fill="currentColor"');
const ICON_LOGIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 16 4-4-4-4"/><path d="M3 12h11"/><path d="M3 8V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/></svg>';
const ICON_DOTS ='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

/* ---------- helpers ---------- */

function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, r => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (r && r.ok) resolve(r.data);
      else reject(new Error((r && r.error) || 'No response from extension.'));
    });
  });
}

let msgTimer;
function showMsg(text, kind = 'err') {
  const m = $('#msg');
  clearTimeout(msgTimer);
  m.textContent = text || '';
  m.className = kind;
  m.style.display = text ? 'block' : 'none';
  if (text && kind === 'ok') msgTimer = setTimeout(() => showMsg(''), 3500);
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function ago(ts) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function cmpVer(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

const prodOf = s => s.envs.find(e => e.env === 'production') || s.envs[0];
const stgOf = s => s.envs.find(e => e.env === 'staging' && e.home_url);

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v; // only used with our own static SVG strings
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n[k] = v;
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
}

async function openTab(url) {
  await chrome.tabs.create({ url });
  window.close();
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return; } catch { /* fall back */ }
  const ta = el('textarea', { value: text });
  document.body.append(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

/* ---------- actions ---------- */

async function login(site_id, env, btn) {
  const label = btn && btn.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  showMsg('');
  try {
    const url = await send({ type: 'magic', site_id, env });
    const sameSite = tab && match && match.site_id === site_id && match.env === env;
    const blankTab = tab && /^(chrome:\/\/newtab|about:blank|edge:\/\/newtab)/.test(tab.url || '');
    if (sameSite || blankTab) await chrome.tabs.update(tab.id, { url });
    else await chrome.tabs.create({ url });
    window.close();
  } catch (e) {
    showMsg(e.message);
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
  }
}

async function togglePin(site_id) {
  if (pins.has(site_id)) pins.delete(site_id); else pins.add(site_id);
  await chrome.storage.local.set({ pins: [...pins] });
  const scroll = $('#list').scrollTop;
  render();
  $('#list').scrollTop = scroll;
}

/* ---------- ⋯ menu ---------- */

function closeMenu() {
  const m = $('#menu');
  m.style.display = 'none';
  m.textContent = '';
}

function openMenu(site, anchorBtn) {
  const m = $('#menu');
  m.textContent = '';
  const prod = prodOf(site);
  const stg = stgOf(site);
  const core = (prod && prod.core) || site.core;

  const info = el('div', { class: 'info' }, el('b', { textContent: site.name }));
  if (core) {
    info.append(`WordPress ${core}`);
    if (latestCore && cmpVer(core, latestCore) < 0) {
      info.append(' · ', el('span', { class: 'behind', textContent: `newest in your sites: ${latestCore}` }));
    }
  }
  m.append(info);

  const item = (label, title, fn) => m.append(el('button', {
    class: 'item', textContent: label, title,
    onclick: async e => {
      e.stopPropagation();
      try { await fn(); } catch (err) { showMsg(err.message); }
      closeMenu();
    }
  }));

  item('Open in Anchor ↗', `anchor.host/account/sites/${site.site_id}`, () => openTab(`${DASHBOARD}sites/${site.site_id}`));
  const home = (prod && prod.home_url) || site.home_url;
  if (home) item('Visit site ↗', hostOf(home), () => openTab(home));
  if (stg) item('Visit staging ↗', hostOf(stg.home_url), () => openTab(stg.home_url));
  m.append(el('hr'));
  item('Copy login link', 'One-time link: paste into another browser or a private window', async () => {
    showMsg('Getting link…', 'ok');
    await copyText(await send({ type: 'magic', site_id: site.site_id, env: prod ? prod.env : 'production' }));
    showMsg('Login link copied. It works once.', 'ok');
  });
  if (stg) item('Copy staging login link', 'One-time link for staging', async () => {
    showMsg('Getting link…', 'ok');
    await copyText(await send({ type: 'magic', site_id: site.site_id, env: 'staging' }));
    showMsg('Staging login link copied. It works once.', 'ok');
  });
  item('phpMyAdmin ↗', 'Production database', async () => {
    showMsg('Opening phpMyAdmin…', 'ok');
    await openTab(await send({ type: 'phpmyadmin', site_id: site.site_id }));
  });
  m.append(el('hr'));
  item(pins.has(site.site_id) ? 'Unpin' : 'Pin to top', '', () => togglePin(site.site_id));

  // Position under the ⋯ button, flipping above it if there isn't room below.
  m.style.display = 'block';
  const b = anchorBtn.getBoundingClientRect();
  const bodyH = document.body.getBoundingClientRect().height;
  const mh = m.offsetHeight;
  let top = b.bottom + 4;
  if (top + mh > bodyH - 4) top = Math.max(4, b.top - mh - 4);
  m.style.top = `${top}px`;
  m.style.left = `${Math.max(8, b.right - m.offsetWidth)}px`;
}

document.addEventListener('click', e => {
  if (!$('#menu').contains(e.target)) closeMenu();
});
// Close on real user scrolling only; a plain 'scroll' listener also fires when the browser
// nudges the list into view during a click, which would close the menu as it opens.
$('#list').addEventListener('wheel', closeMenu, { passive: true });

/* ---------- list ---------- */

function search(q) {
  q = q.trim().toLowerCase();
  const hits = sites.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.slug.toLowerCase().includes(q) ||
    s.envs.some(e => e.home_url.toLowerCase().includes(q))
  );
  const score = s => (s.name.toLowerCase().startsWith(q) ? 0 : 2) + (pins.has(s.site_id) ? 0 : 1);
  return hits.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

// Returns [{label}] section headers and [{site, meta}] rows.
function buildRows() {
  const q = $('#q').value.trim();
  if (view === 'recent') {
    const seen = new Set();
    const rows = [{ label: 'Recent logins' }];
    for (const r of recent) {
      const s = byId.get(r.site_id);
      const key = `${r.site_id}:${r.env}`;
      if (!s || seen.has(key)) continue;
      if (q && !search(q).includes(s)) continue;
      seen.add(key);
      rows.push({ site: s, meta: { env: r.env, at: r.at } });
    }
    return rows;
  }
  if (q) return search(q).map(s => ({ site: s }));
  const pinned = sites.filter(s => pins.has(s.site_id));
  if (!pinned.length) return sites.map(s => ({ site: s }));
  return [
    { label: 'Pinned' }, ...pinned.map(s => ({ site: s })),
    { label: 'All sites' }, ...sites.filter(s => !pins.has(s.site_id)).map(s => ({ site: s }))
  ];
}

// Favicon straight from the site's /favicon.ico (WordPress serves the Site Icon there).
// Loaded lazily, so only rows you scroll to are fetched, and the browser caches them.
// If there's no icon, or it fails to load, show a colored first letter instead.
function favicon(s, url) {
  const letter = (s.name.replace(/^www\./i, '')[0] || '?').toUpperCase();
  let hash = 0;
  for (const ch of s.name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const box = el('span', { class: 'fav', textContent: letter });
  box.style.background = `hsl(${hash % 360} 55% 45%)`;
  const host = hostOf(url);
  if (!host || !/^https?:/.test(url)) return box;
  // The img has to be in the page for lazy loading to start, so it sits (hidden) inside the
  // letter box and swaps in once it has loaded.
  const img = el('img', { alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' });
  img.style.cssText = 'position:absolute;inset:0;opacity:0;'; // laid out (so lazy load triggers) but invisible
  img.addEventListener('load', () => {
    if (img.naturalWidth < 2) return img.remove(); // 1x1 placeholder = no real icon
    box.firstChild.remove(); // the letter
    box.style.background = ''; // drop the letter color so the theme's favicon tile shows
    box.classList.add('has-img');
    img.style.cssText = '';
  });
  img.addEventListener('error', () => img.remove());
  img.src = `${new URL(url).origin}/favicon.ico`;
  box.append(img);
  return box;
}

function siteRow(s, meta, index) {
  const prod = prodOf(s);
  const stg = stgOf(s);
  const url = (prod && prod.home_url) || s.home_url;
  const isPinned = pins.has(s.site_id);

  const host = el('div', { class: 'host' });
  if (meta && meta.env === 'staging' && stg) {
    host.append(el('a', { href: stg.home_url, target: '_blank', textContent: hostOf(stg.home_url) }), ' · ', el('span', { class: 'tag', textContent: 'staging' }));
  } else if (url) {
    host.append(el('a', { href: url, target: '_blank', textContent: hostOf(url) }));
  }
  if (meta && meta.at) host.append(` · ${ago(meta.at)}`);
  host.append(' · ', el('span', { class: 'id', textContent: `#${s.site_id}`, title: `Anchor site ID ${s.site_id}` }));

  const row = el('div', { class: 'site' + (index === sel ? ' sel' : '') },
    favicon(s, url),
    el('div', { class: 'info' }, el('div', { class: 'nm', textContent: s.name, title: `${s.name} · ID ${s.site_id}` }), host),
    el('button', {
      class: 'icon pin' + (isPinned ? ' pinned' : ''), title: isPinned ? 'Unpin' : 'Pin to top',
      html: isPinned ? ICON_PIN_FILLED : ICON_PIN,
      onclick: e => { e.stopPropagation(); togglePin(s.site_id); }
    }),
    el('button', {
      class: 'icon dots', title: 'More', html: ICON_DOTS,
      onclick: e => { e.stopPropagation(); openMenu(s, e.currentTarget); }
    })
  );
  if (stg) {
    row.append(el('button', {
      class: 'stg', textContent: 'STG', title: hostOf(stg.home_url),
      onclick: e => login(s.site_id, 'staging', e.currentTarget)
    }));
  }
  row.append(el('button', {
    class: 'go', html: ICON_LOGIN, title: hostOf(url) || s.name, ariaLabel: `Log in to ${s.name}`,
    onclick: e => login(s.site_id, (prod && prod.env) || 'production', e.currentTarget)
  }));
  return row;
}

function render() {
  closeMenu();
  const list = $('#list');
  list.textContent = '';
  const rows = buildRows();
  items = rows.filter(r => r.site);
  if (sel >= items.length) sel = Math.max(0, items.length - 1);

  if (!items.length) {
    let text = sites.length ? 'No sites match.' : 'No sites found.';
    if (view === 'recent' && !$('#q').value.trim()) text = 'No recent logins yet. Sites you log into will show up here.';
    list.append(el('div', { class: 'empty', textContent: text }));
  }
  const frag = document.createDocumentFragment();
  let i = 0;
  for (const r of rows) {
    if (r.label) { if (items.length) frag.append(el('div', { class: 'section', textContent: r.label })); continue; }
    frag.append(siteRow(r.site, r.meta, i++));
  }
  list.append(frag);

  $('#recentBtn').textContent = view === 'recent' ? 'All sites' : 'Recent';
  $('#status').textContent = sites.length ? `${sites.length} sites · updated ${ago(updated)}` : '';
}

function moveSel(delta) {
  if (!items.length) return;
  closeMenu();
  const rowsEls = $('#list').querySelectorAll('.site');
  if (rowsEls[sel]) rowsEls[sel].classList.remove('sel');
  sel = (sel + delta + items.length) % items.length;
  if (rowsEls[sel]) {
    rowsEls[sel].classList.add('sel');
    rowsEls[sel].scrollIntoView({ block: 'nearest' });
  }
}

function selectedRowButton(which) {
  const rowEl = $('#list').querySelectorAll('.site')[sel];
  return rowEl && rowEl.querySelector(which === 'staging' ? 'button.stg' : 'button.go');
}

// Is the user already logged into WordPress in this tab? WordPress marks logged-in pages:
// front end: <body class="logged-in"> and the admin bar (#wpadminbar); wp-admin: <body class="wp-admin …">.
async function isLoggedIn(tabId) {
  // 1) Ask our content script, which already runs on the page.
  try {
    const r = await chrome.tabs.sendMessage(tabId, { type: 'wpState' });
    if (r && typeof r.loggedIn === 'boolean') return r.loggedIn;
  } catch { /* page was open before the extension loaded; try the fallback */ }
  // 2) Fallback: check the page directly (allowed because you just clicked the extension).
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const b = document.body;
        return !!(b && (b.classList.contains('logged-in') || b.classList.contains('wp-admin'))) ||
          !!document.getElementById('wpadminbar');
      }
    });
    return !!(res && res.result);
  } catch {
    return false; // can't tell: show the login button
  }
}

async function renderCurrent() {
  const box = $('#current');
  if (!match) { box.style.display = 'none'; return; }
  const nm = box.querySelector('.nm');
  nm.textContent = hostOf(match.home_url) || match.name;
  nm.title = `${match.name} · ID ${match.site_id}`;
  if (match.env === 'staging') nm.append(el('span', { class: 'tag', textContent: 'staging' }));
  box.style.display = 'flex';

  const loggedIn = await isLoggedIn(tab.id);
  box.querySelector('.status').hidden = !loggedIn;
  const go = $('#currentGo');
  go.hidden = loggedIn;
  if (!loggedIn) {
    go.innerHTML = ICON_LOGIN;
    go.title = `Log in to ${hostOf(match.home_url)}`;
  }
}

/* ---------- load ---------- */

function guideLink(text, url) {
  return el('a', { class: 'guide', href: url, textContent: text, onclick: e => { e.preventDefault(); openTab(url); } });
}

// Shown in place of the site list until a login is saved, so a first-time user sees what to do
// next instead of an error. Checked before calling the API, so it never waits on the network.
function showConnect() {
  const list = $('#list');
  list.textContent = '';
  list.append(el('div', { class: 'connect' },
    el('b', { textContent: 'Connect your Anchor account' }),
    el('p', { textContent: 'Add your Anchor username and an application password to search your sites and log in.' }),
    el('button', { textContent: 'Open Settings', onclick: () => chrome.runtime.openOptionsPage() }),
    guideLink('Setup guide on GitHub ↗', SETUP_URL)
  ));
}

async function load(force) {
  showMsg('');
  const { user, pass } = await chrome.storage.local.get(['user', 'pass']);
  if (!user || !pass) return showConnect();
  try {
    const data = await send({ type: 'getSites', force });
    sites = data.sites;
    updated = data.updated;
    byId = new Map(sites.map(s => [s.site_id, s]));
    latestCore = sites.reduce((max, s) => {
      const c = (prodOf(s) && prodOf(s).core) || s.core;
      return c && (!max || cmpVer(c, max) > 0) ? c : max;
    }, '');
    render();
  } catch (e) {
    const list = $('#list');
    list.textContent = '';
    const d = el('div', { class: 'empty', textContent: e.message });
    if (/Settings/.test(e.message)) {
      d.append(el('br'), el('button', { textContent: 'Open Settings', style: 'margin-top:10px', onclick: () => chrome.runtime.openOptionsPage() }));
    }
    d.append(guideLink('Troubleshooting ↗', HELP_URL));
    list.append(d);
  }
}

async function init() {
  const stored = await chrome.storage.local.get(['pins', 'recent']);
  pins = new Set(stored.pins || []);
  recent = stored.recent || [];
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await load(false);
  if (tab && /^https?:/.test(tab.url || '') && sites.length) {
    try {
      match = await send({ type: 'lookup', url: tab.url });
      renderCurrent();
    } catch { /* ignore */ }
  }
}

/* ---------- events ---------- */

$('#q').addEventListener('input', () => { sel = 0; render(); });
$('#q').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const btn = selectedRowButton(e.shiftKey ? 'staging' : 'production');
    if (btn) btn.click();
    else if (e.shiftKey) showMsg('That site has no staging environment.');
  } else if (e.key === 'Escape' && $('#menu').style.display === 'block') {
    e.preventDefault();
    closeMenu();
  }
});
$('#currentGo').addEventListener('click', e => match && login(match.site_id, match.env, e.currentTarget));
$('#refresh').addEventListener('click', () => load(true));
$('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#recentBtn').addEventListener('click', async () => {
  recent = (await chrome.storage.local.get('recent')).recent || [];
  view = view === 'recent' ? 'all' : 'recent';
  sel = 0;
  render();
  $('#q').focus();
});
$('#dash').addEventListener('click', e => { e.preventDefault(); openTab(DASHBOARD); });

init();
