// Anchor Magic Login — background service worker.
// All API calls happen here so the password never touches web pages,
// and so requests to anchor.host aren't blocked by CORS.

const BASE = 'https://anchor.host/wp-json/captaincore/v1';
const DASHBOARD = 'https://anchor.host/account/';
const CACHE_MS = 6 * 60 * 60 * 1000; // refresh the site list every 6 hours
const RECENT_MAX = 10;

/* ---------- API ---------- */

async function getCreds() {
  const { user, pass } = await chrome.storage.local.get(['user', 'pass']);
  if (!user || !pass) {
    throw new Error('Add your Anchor username and application password in Settings.');
  }
  return { user, pass };
}

async function api(path, creds) {
  const c = creds || (await getCreds());
  let res;
  try {
    res = await fetch(BASE + path, {
      headers: {
        Authorization: 'Basic ' + btoa(`${c.user}:${c.pass}`),
        Accept: 'application/json'
      },
      credentials: 'omit', // don't mix in browser cookies from anchor.host
      cache: 'no-store'
    });
  } catch (e) {
    throw new Error('Could not reach anchor.host. Check your connection.');
  }
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.trim(); }

  if (res.status === 401) {
    throw new Error('Anchor rejected the login. Check your username and application password in Settings.');
  }
  if (!res.ok) {
    const msg = body && body.message ? body.message : `HTTP ${res.status}`;
    throw new Error(`Anchor API error: ${msg}`);
  }
  return body;
}

/* ---------- Sites ---------- */

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}

function simplify(raw) {
  if (!Array.isArray(raw)) throw new Error('Unexpected response from Anchor when listing sites.');
  return raw
    .filter(s => !s.removed)
    .map(s => {
      let envs = (s.environments || []).map(e => ({
        env: String(e.environment || 'production').toLowerCase(),
        home_url: e.home_url || '',
        core: e.core || ''
      }));
      if (!envs.length) envs = [{ env: 'production', home_url: s.home_url || '', core: s.core || '' }];
      return {
        site_id: s.site_id,
        name: s.name || s.site || String(s.site_id),
        slug: s.site || '',
        home_url: s.home_url || '',
        core: s.core || '',
        envs
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getSites(force) {
  const { cache } = await chrome.storage.local.get('cache');
  if (!force && cache && Date.now() - cache.updated < CACHE_MS) return cache;
  try {
    const fresh = { sites: simplify(await api('/sites')), updated: Date.now() };
    await chrome.storage.local.set({ cache: fresh });
    return fresh;
  } catch (e) {
    if (!force && cache) return cache; // fall back to the stale list rather than failing
    throw e;
  }
}

async function lookup(url) {
  const host = hostOf(url);
  if (!host) return null;
  const { sites } = await getSites(false);
  for (const s of sites) {
    for (const e of s.envs) {
      if (e.home_url && hostOf(e.home_url) === host) {
        return { site_id: s.site_id, name: s.name, env: e.env, home_url: e.home_url };
      }
    }
    if (s.home_url && hostOf(s.home_url) === host) {
      return { site_id: s.site_id, name: s.name, env: 'production', home_url: s.home_url };
    }
  }
  return null;
}

// Same ranking as the popup: name starts with the query first, then anything containing it.
function search(sites, q, pins) {
  q = q.trim().toLowerCase();
  const pinSet = new Set(pins || []);
  const hits = sites.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.slug.toLowerCase().includes(q) ||
    s.envs.some(e => e.home_url.toLowerCase().includes(q))
  );
  const score = s => (s.name.toLowerCase().startsWith(q) ? 0 : 2) + (pinSet.has(s.site_id) ? 0 : 1);
  return hits.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

/* ---------- Login links ---------- */

async function addRecent(site_id, env) {
  const { recent = [] } = await chrome.storage.local.get('recent');
  const next = [{ site_id, env, at: Date.now() }]
    .concat(recent.filter(r => !(r.site_id === site_id && r.env === env)))
    .slice(0, RECENT_MAX);
  await chrome.storage.local.set({ recent: next });
}

async function magic(site_id, env) {
  const safeEnv = env === 'staging' ? 'staging' : 'production';
  const id = Number(site_id);
  const body = await api(`/sites/${encodeURIComponent(id)}/${safeEnv}/magiclogin`);
  if (typeof body === 'string' && /^https?:\/\//i.test(body)) {
    addRecent(id, safeEnv);
    return body;
  }
  const detail = typeof body === 'string' ? body : JSON.stringify(body);
  throw new Error("Anchor didn't return a login link" + (detail ? `: ${detail.slice(0, 200)}` : '.'));
}

async function phpmyadmin(site_id) {
  const body = await api(`/sites/${encodeURIComponent(Number(site_id))}/production/phpmyadmin`);
  if (typeof body === 'string' && /^https?:\/\//i.test(body)) return body;
  throw new Error("Anchor didn't return a phpMyAdmin link.");
}

/* ---------- Messages from popup, settings and login pages ---------- */

async function handle(msg, sender) {
  // True for the content script on a login page; false for our own popup/settings pages
  // (settings opens in a tab, so sender.tab alone can't tell them apart).
  const fromPage = !(sender.url || '').startsWith(chrome.runtime.getURL(''));

  if (fromPage) {
    // Web pages only get to ask "is this one of my sites?" and "log me in here".
    // The site is always worked out from the tab's real URL, never from the page.
    if (msg.type === 'lookup') return lookup(sender.url);
    if (msg.type === 'magic') {
      const match = await lookup(sender.url);
      if (!match) throw new Error('This site is not in your Anchor account.');
      return magic(match.site_id, match.env);
    }
    throw new Error('Not allowed.');
  }

  switch (msg.type) {
    case 'getSites': return getSites(!!msg.force);
    case 'lookup': return lookup(msg.url);
    case 'magic': return magic(msg.site_id, msg.env);
    case 'phpmyadmin': return phpmyadmin(msg.site_id);
    case 'test': return api('/me', { user: msg.user, pass: msg.pass });
    default: throw new Error('Unknown request.');
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg || {}, sender).then(
    data => sendResponse({ ok: true, data }),
    err => sendResponse({ ok: false, error: (err && err.message) || String(err) })
  );
  return true; // keep the channel open for the async response
});

/* ---------- Toolbar indicator: a colored dot on the icon when the tab is one of your sites ---------- */
// Chrome's built-in badge can only show text in a rounded rectangle, so instead we draw the
// extension icon with a small circle in the bottom-right corner and set it for that tab.

const DOT_COLORS = { production: '#3858e9', staging: '#e1a948' };
const DEFAULT_ICON = { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' };
let baseBitmap = null;
const dotIconCache = {};

async function dotIcon(env) {
  if (dotIconCache[env]) return dotIconCache[env];
  if (!baseBitmap) {
    const blob = await (await fetch(chrome.runtime.getURL('icons/icon128.png'))).blob();
    baseBitmap = await createImageBitmap(blob);
  }
  const imageData = {};
  for (const size of [16, 32]) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(baseBitmap, 0, 0, size, size);
    const r = size * 0.25;             // dot radius: 4px at 16px, 8px at 32px
    const ring = size / 16;            // white outline: 1px at 16px, 2px at 32px
    const c = size - r - ring;         // center, tucked into the bottom-right corner
    ctx.beginPath();
    ctx.arc(c, c, r + ring, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = DOT_COLORS[env];
    ctx.fill();
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  return (dotIconCache[env] = imageData);
}

async function updateBadge(tabId, url) {
  let match = null;
  if (/^https?:/i.test(url || '')) {
    try { match = await lookup(url); } catch { /* not set up yet */ }
  }
  try {
    await chrome.action.setBadgeText({ tabId, text: '' }); // clear the old WP/STG text badge
    if (!match) {
      await chrome.action.setIcon({ tabId, path: DEFAULT_ICON });
      await chrome.action.setTitle({ tabId, title: 'Anchor Magic Login' });
      return;
    }
    const staging = match.env === 'staging';
    await chrome.action.setIcon({ tabId, imageData: await dotIcon(staging ? 'staging' : 'production') });
    await chrome.action.setTitle({ tabId, title: `Anchor: ${hostOf(match.home_url)} (${staging ? 'staging' : 'live'})` });
  } catch { /* tab closed meanwhile */ }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === 'complete') updateBadge(tabId, tab.url);
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try { const tab = await chrome.tabs.get(tabId); updateBadge(tabId, tab.url); } catch { /* ignore */ }
});

/* ---------- Address bar: type "wp" + space, then part of a site name ---------- */

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const DEFAULT_HINT = 'Anchor: type part of a site name, then Enter to log in  ·  "dash" opens the Anchor dashboard';
chrome.omnibox.setDefaultSuggestion({ description: esc(DEFAULT_HINT) });

chrome.omnibox.onInputStarted.addListener(() => {
  chrome.omnibox.setDefaultSuggestion({ description: esc(DEFAULT_HINT) });
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const q = text.trim();
  if (!q) { chrome.omnibox.setDefaultSuggestion({ description: esc(DEFAULT_HINT) }); return suggest([]); }
  if (/^dash(board)?$/i.test(q)) {
    chrome.omnibox.setDefaultSuggestion({ description: 'Open the <match>Anchor dashboard</match> <url>anchor.host/account</url>' });
    return suggest([]);
  }
  let sites, pins;
  try {
    ({ sites } = await getSites(false));
    ({ pins = [] } = await chrome.storage.local.get('pins'));
  } catch (e) {
    chrome.omnibox.setDefaultSuggestion({ description: esc(e.message) });
    return suggest([]);
  }
  const hits = search(sites, q, pins).slice(0, 6);
  if (!hits.length) {
    chrome.omnibox.setDefaultSuggestion({ description: `No Anchor sites match <match>${esc(q)}</match>` });
    return suggest([]);
  }
  const top = hits[0];
  const topProd = top.envs.find(e => e.env === 'production') || top.envs[0];
  const topStg = top.envs.find(e => e.env === 'staging' && e.home_url);
  chrome.omnibox.setDefaultSuggestion({
    description: `Log in to <match>${esc(top.name)}</match>  <url>${esc(hostOf(topProd.home_url || top.home_url))}</url>`
  });

  const out = [];
  if (topStg) out.push({ content: `#${top.site_id}:staging`, description: `Log in to <match>${esc(top.name)}</match> staging  <url>${esc(hostOf(topStg.home_url))}</url>` });
  out.push({ content: `#anchor:${top.site_id}`, description: `Open <match>${esc(top.name)}</match> in the Anchor dashboard` });
  for (const s of hits.slice(1)) {
    const p = s.envs.find(e => e.env === 'production') || s.envs[0];
    out.push({ content: `#${s.site_id}:production`, description: `Log in to <match>${esc(s.name)}</match>  <url>${esc(hostOf(p.home_url || s.home_url))}</url>` });
  }
  suggest(out);
});

async function openUrl(url, disposition) {
  if (disposition === 'newForegroundTab') return chrome.tabs.create({ url });
  if (disposition === 'newBackgroundTab') return chrome.tabs.create({ url, active: false });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? chrome.tabs.update(tab.id, { url }) : chrome.tabs.create({ url });
}

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const t = text.trim();
  try {
    if (/^dash(board)?$/i.test(t) || !t) return openUrl(DASHBOARD, disposition);

    const anchorPage = t.match(/^#anchor:(\d+)$/);
    if (anchorPage) return openUrl(`${DASHBOARD}sites/${anchorPage[1]}`, disposition);

    let target;
    const direct = t.match(/^#(\d+):(production|staging)$/);
    if (direct) {
      target = { site_id: Number(direct[1]), env: direct[2] };
    } else {
      const { sites } = await getSites(false);
      const { pins = [] } = await chrome.storage.local.get('pins');
      const top = search(sites, t, pins)[0];
      if (!top) return;
      target = { site_id: top.site_id, env: (top.envs.find(e => e.env === 'production') || top.envs[0]).env };
    }
    const url = await magic(target.site_id, target.env);
    await openUrl(url, disposition);
  } catch (e) {
    // No UI in the address bar to show errors, so send them to Settings when setup is the problem.
    if (/Settings/.test(e.message)) chrome.runtime.openOptionsPage();
    console.error('Anchor Magic Login:', e);
  }
});
