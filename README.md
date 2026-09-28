# Anchor Magic Login — Chrome extension

Version 1.5.0 · for Anchor Hosting (CaptainCore) accounts

Search all your Anchor sites and jump into wp-admin with a one-click login link, from the toolbar,
the address bar, or the site's own login page.

> **Unofficial.** This is an independent, community-made extension. It is not affiliated with, endorsed by,
> or supported by Anchor Hosting or CaptainCore. It uses the public CaptainCore API with your own credentials.

Works in Chrome on Windows, macOS and Linux. Keyboard shortcuts are written as **Windows / Mac**.
On a Mac, **Option** is the Alt key and **Return** is the Enter key.

---

## Contents
1. How to Install (Developer Mode)
2. Connect your Anchor account
3. Keyboard shortcut (Alt+Shift+A / Option+Shift+A)
4. The popup
5. Pinned sites
6. Recent logins
7. The ⋯ menu (per site)
8. Address bar shortcut: `wp`
9. Toolbar indicator
10. Login-page card (including custom login URLs)
11. Updating the extension
12. Permissions and privacy
13. Troubleshooting
14. Files in this folder

---

## 1. How to Install (Developer Mode)
1. Download or clone this repository to your computer:
   `git clone https://github.com/YOUR-USERNAME/anchor-magic-login.git`
   Or click **Code → Download ZIP** on GitHub and unzip it.

   Chrome runs the extension from this folder, so keep it somewhere permanent (not Downloads, where it's easy
   to clean up by accident) and don't delete or move it. For example:
   - Windows: `C:\chrome-extensions\anchor-magic-login`
   - Mac: `~/chrome-extensions/anchor-magic-login` (a `chrome-extensions` folder in your home folder)
2. Open Google Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode** with the toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the project folder, the one containing `manifest.json`.
6. Click the puzzle-piece icon in the toolbar and **pin** Anchor Magic Login.

## 2. Connect your Anchor account
1. In Anchor, go to **Profile → Application passwords**, type `Chrome extension`, and click **+ New password**.
   Copy the password right away, because it's shown only once.
2. Open the extension's **Settings** (link at the bottom of the popup, or right-click the icon → Options; on a Mac, Control-click also works).
3. Enter your Anchor username (your email usually works) and the application password, then click **Save & test**.
   You should see "Connected as … Loaded N sites."

To disconnect, click **Remove saved login** in Settings, or revoke the "Chrome extension" password in Anchor.

## 3. Keyboard shortcut (Alt+Shift+A / Option+Shift+A)
**Alt+Shift+A** (Mac: **Option+Shift+A**) opens the popup. Don't confuse it with **Ctrl+Shift+A**
(Mac: **⌘+Shift+A**), which is Chrome's own "Search tabs".

If the shortcut does nothing:
1. Go to `chrome://extensions/shortcuts`.
2. Find **Anchor Magic Login → Activate the extension**.
3. Click the pencil icon and press **Alt+Shift+A** (Mac: **Option+Shift+A**), or any combination you like.

Chrome only assigns a suggested shortcut when an extension is first installed, and skips it if another
extension already uses that combination. That's why it sometimes needs setting by hand.

## 4. The popup
- **Search** filters by site name, slug or domain. Names that *start* with what you type come first.
- **↑ / ↓** moves the highlight. **Enter** (Mac: **Return**) logs into the highlighted site (production).
  **Shift+Enter** (Mac: **Shift+Return**) logs into its staging site.
- The blue **login icon** (→ into a box) logs into production. **STG** logs into staging, and only appears when the site
  has a staging environment. Hover either button to see the domain it goes to.
- Each site shows its **favicon**, loaded from the site's own `/favicon.ico`. WordPress serves the Site Icon there.
  Sites without an icon get a colored first letter instead. Icons load only as you scroll to them and are cached by Chrome.
- Each row shows the site's **Anchor ID** in small text after the domain (e.g. `example.com · #123`).
  Hovering the site name shows it too ("example.com · ID 123").
- The list uses a slim 6px scrollbar that matches the light or dark theme.
- **This tab** (a one-line strip under the search box) appears when your current tab is one of your sites,
  showing its domain (plus "staging" when it's a staging site).
  - If you're **not** logged in, a login icon logs you in right there, in the same tab.
  - If you **are** already logged in, it shows **✓ Logged in** instead of the button. It detects this from WordPress's
    own markers: `<body class="logged-in">` or the admin bar on the front end, and `<body class="wp-admin">` in the dashboard.
  - A tab that was already open before you installed or reloaded the extension may always show the login icon. Refresh that page to fix it.
- **Anchor dashboard ↗** (top right) opens `anchor.host/account` in a new tab.
- The login opens in the current tab if you're already on that site (or on a blank new tab), otherwise in a new tab.
- The footer shows how many sites are loaded and when. **Refresh** reloads the list from Anchor.
  The list refreshes automatically every 6 hours.

## 5. Pinned sites
- Hover a site and click the small **pin** icon, or use **⋯ → Pin to top**.
- Pinned sites get their own **Pinned** section at the top of the list, and their pin icon stays visible and blue.
- Pinned sites also rank first when you search, and in the address-bar shortcut.
- Click the pin again (or **⋯ → Unpin**) to remove it.

## 6. Recent logins
- Click **Recent** in the footer to see the last 10 sites you logged into, newest first, with how long ago.
  Click **All sites** to go back.
- A staging login shows up as its own entry, tagged "staging".
- Logins from the popup, the address bar and the login-page card all count.
- Search and the arrow keys work in the Recent view too.

## 7. The ⋯ menu (per site)
Click **⋯** on any site:

| Item | What it does |
|---|---|
| (header) | Site name and WordPress version. Shows "newest in your sites: X" in amber when this site is behind the newest version running on any of your sites. |
| Open in Anchor ↗ | Opens the site's page in the dashboard (`anchor.host/account/sites/{id}`) in a new tab |
| Visit site ↗ / Visit staging ↗ | Opens the front end in a new tab |
| Copy login link | Copies a one-time login link to your clipboard, e.g. to paste into a private window or another browser. It works once. |
| Copy staging login link | The same for staging (only shown when the site has staging) |
| phpMyAdmin ↗ | Opens the production database in phpMyAdmin via Anchor's single sign-on |
| Pin to top / Unpin | Same as the pin icon |

Press **Esc** or click anywhere else to close the menu.

## 8. Address bar shortcut: `wp`
1. Click the address bar (or press **Ctrl+L** / Mac: **⌘+L**), type **`wp`** and then a **space**.
   Chrome switches to "Anchor Magic Login" mode.
2. Type part of a site name, e.g. `wp examp`.
3. Press **Enter** (Mac: **Return**) to log into the top match (production).

Chrome also shows extra suggestions under the top match. Use ↓ to pick one:
- *Log in to … staging*
- *Open … in the Anchor dashboard*
- other matching sites

More options:
- `wp dash` + Enter opens the Anchor dashboard.
- **Alt+Enter** (Mac: **Option+Return**) opens the result in a new tab instead of the current one.
  On a Mac, **⌘+Return** opens it in a background tab.
- Getting the login link takes a second or two after you press Enter.
- If you haven't connected your account yet, pressing Enter opens Settings.

## 9. Toolbar indicator
When the current tab is one of your Anchor sites, a small colored dot appears in the bottom-right corner of the extension icon:
- **Blue dot** (`#3858e9`): a live (production) site
- **Amber dot** (`#e1a948`): a staging site

The dot has a thin white ring so it stands out against the blue icon. Hover the icon to see which site it matched,
e.g. "Anchor: example.com (live)". The indicator works from the cached site list, so it doesn't call Anchor on every page.

## 10. Login-page card (including custom login URLs)
When you land on the WordPress login page of one of your sites, a dark card appears in the bottom-right corner.
Click **Log in with magic link** to go straight into wp-admin. Click **×** to dismiss it.

- It works on `wp-login.php` **and** on custom login URLs such as WPS Hide Login's `/my-secret-login`.
  It recognizes WordPress's standard login form (`<body class="login">` with `<form id="loginform">`),
  so the URL doesn't matter.
- It stays hidden on logout, lost-password and registration pages, and on any site that isn't in your Anchor account.
- On ordinary pages the script only checks for that login form and stops. It doesn't contact Anchor.
- A login page with a heavily customized or replaced form (some security or membership plugins) may not be recognized.
  The popup and the address bar shortcut still work for those sites.

## 11. Updating the extension
1. If you cloned the repository, run `git pull` in the folder. If you downloaded the ZIP, unzip the new version
   over this folder, replacing the files.
2. Go to `chrome://extensions` and click the **reload** icon (↻) on Anchor Magic Login.

Your saved login, pins and recent list are kept.

## 12. Permissions and privacy
Favicons are requested directly from each of your own sites (`https://yoursite/favicon.ico`), with no referrer and no third-party icon service.

| Permission | Why |
|---|---|
| anchor.host | Calls the Anchor API (site list, login links, phpMyAdmin) |
| Read and change data on all websites | Needed to recognize WordPress login pages on any domain, including custom login URLs. The script only looks for the login form and changes nothing except adding the card. |
| Tabs | Reads the current tab's address, for the toolbar badge and the "This tab" shortcut |
| Storage | Saves your login, the cached site list, pins and recent logins in this Chrome profile |
| Clipboard | "Copy login link" |
| Scripting | Fallback check for "already logged in" on the current tab, only when you open the popup |

- Your application password is stored only in this Chrome profile on this computer and is sent only to anchor.host.
- Web pages never see the password. They can only ask "is this site one of mine?" and "log me in here",
  and the extension works out the site from the tab's real address, not from anything the page says.
- Use a dedicated "Chrome extension" application password so you can revoke it on its own.

## 13. Troubleshooting
- **"Anchor rejected the login"**: the username or password is wrong, or the password was revoked. Create a new one and save it in Settings.
- **A new site is missing**: click **Refresh** in the popup.
- **No card on a login page**: check that the site's domain in Anchor matches the one you're on (www and non-www are treated as the same).
  Custom login forms may not be recognized (see section 10). Use the popup instead.
- **Alt+Shift+A / Option+Shift+A doesn't work**: see section 3.
- **Something else**: go to `chrome://extensions`, click **Errors** or **service worker** on the extension card, and check the console.

## 14. Files in this folder
| File | Purpose |
|---|---|
| `manifest.json` | Extension definition: permissions, shortcut, address-bar keyword |
| `background.js` | Talks to the Anchor API, caches sites, and runs the badge and address-bar shortcut |
| `popup.html` / `popup.js` | The toolbar popup |
| `options.html` / `options.js` | The Settings page |
| `content.js` | The login-page card |
| `icons/` | Toolbar icons |
