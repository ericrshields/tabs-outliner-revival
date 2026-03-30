# 10. Configuration & Build

> **Sources**: `wxt.config.ts`, `package.json`, `vitest.config.ts` -- read these files for full configuration details.

---

## 10.1 Permissions

**Required permissions** (granted at install):

| Permission | Used By |
|---|---|
| `alarms` | Service worker keep-alive, periodic save scheduling |
| `storage` | Tree persistence, settings, session data |
| `tabs` | Tab tracking, creation, removal, focus management |
| `unlimitedStorage` | Large tree data (thousands of nodes) |
| `favicon` | `chrome://favicon/` API for tab favicons |

**Optional permissions** (requested at runtime):

| Permission | Used By |
|---|---|
| `identity` | Google OAuth2 for Drive backup |
| `identity.email` | Email-based license validation |
| `system.display` | Work area detection for window positioning |
| `clipboardRead` | Paste tree data from clipboard |
| `clipboardWrite` | Copy tree data to clipboard |

---

## 10.2 Path Alias

`@/` resolves to `src/` directory. Implemented via a custom Vite plugin (`enforce: 'pre'`) in `wxt.config.ts` that tries extensions in order: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `''`, then `/index` variants. `tsconfig.json` has a matching alias for editor support.

---

## 10.3 Versioning

Two version fields must be kept in sync:

| Field | Location | Format | Current |
|---|---|---|---|
| `manifest.version` | `wxt.config.ts` | Chrome quad-version: `MAJOR.MINOR.PATCH.BUILD` | `2.0.1.1` |
| `version` / `version_name` | `wxt.config.ts` / `package.json` | SemVer with pre-release | `2.0.0-beta.1` |

Both must be bumped on every epic commit to main. Beta bumps increment the `version_name` patch segment (`2.0.1.N`); v1 resets to `2.0.0.0`.

---

## 10.4 Content Security Policy

`script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'` -- scripts from extension origin only, inline styles allowed (needed for Preact).
