# Tabs Outliner — Fan Modernization

A fan-built Manifest V3 modernization of [Tabs Outliner](https://chromewebstore.google.com/detail/tabs-outliner/eggkanocgddhmamlbiijnphhppkpkmkl) by **Vladyslav Volovyk** — the tab and session management extension originally released in 2012.

This project does not and never will require payment. It exists as a passion project to preserve a product I've relied on for over a decade. All design and conceptual credit belongs to Vladyslav. Copyright headers are preserved throughout the source.

- Original on the Chrome Web Store: <https://chromewebstore.google.com/detail/tabs-outliner/eggkanocgddhmamlbiijnphhppkpkmkl>
- Original site: <https://tabsoutliner.com/>

## Status

- **Version:** 2.0.0-rc.1 (May 2026)
- **Tests:** ~950 unit and integration
- **Stack:** TypeScript, WXT, Preact, react-arborist, IndexedDB
- **Distribution:** **not published to the Chrome Web Store.** Available as a developer load-only build from this repository.

## History

I've used Tabs Outliner since the early days of the original — likely before 2014. Around 2020 I started maintaining personal patches against the original codebase to keep it working. The triggers were specific, not abstract: I lost my entire tree twice and needed to fix the data-loss path, and I wanted to pay for the premium features but the in-extension payment flow always told me "you need to be logged into Chrome to do this" and never went through, regardless of which browser I tried, despite verifying many times over that I was in fact logged in.

After those initial patches I kept using the extension. Over time more small bugs accumulated, and by late 2025 it made more sense to rewrite than keep trial-and-error patching the original codebase. The result is this repository — modern toolchain, following the spirit of the original as closely as possible while taking liberties on some details (a different context menu design, additional keyboard options, tabs that default to save-and-close even without a note, simple CSS/icons in place of bitmap images).

In starting the rewrite I assumed the original was no longer being maintained. The user-visible signal supported that read: recent reviews on the Chrome Web Store had been a long string of "stopped working" and "lost my tabs" reports, with no developer responses. I have since discovered that the original received an MV3 update in August 2024 and a patch in April 2026 (1.4.167), and that a developer reply finally appeared on a review in late April 2026. The author has returned. I'm reaching out to him directly to determine the future of this project.

## License posture

The source project was presumed inactive for many years, which is the typical window in which fan restoration projects emerge. I have since discovered that the author has returned, and I'm in the process of reaching out to determine the future of this project together.

The original Tabs Outliner ships under a restrictive EULA, preserved at `legacy/LICENSE.TXT`. The top-level `LICENSE` file is a placeholder pending that conversation. **No commercial use, no public distribution under the original name, and no Chrome Web Store submission** until the licensing posture is settled directly with the author.

## Local install

> **Back up first.** A small chance of issues during install or migration could cause data loss in your existing tree. Before continuing, do one of the following:
>
> - **Recommended (if you have it):** use the original's paid backup feature to export a `.tree` file.
> - **Alternative:** copy the original extension's IndexedDB data out of your Chrome profile directory. Look for the `IndexedDB` folder under your Chrome profile and locate the database for extension ID `eggkanocgddhmamlbiijnphhppkpkmkl`.

1. Clone this repository or download the source.
2. Build:
   ```bash
   npm install
   npm run build
   ```
3. In Chrome, open `chrome://extensions` and enable **Developer mode** (toggle, top right).
4. Click **Load unpacked** and select the `.output/chrome-mv3/` folder from this repo.
5. Import your existing tree — choose one path:
   - **Drag and drop:** open the original extension's tree alongside this one and drag nodes from the original onto the new tree. (Use "Expand All" in the original first; collapsed subtrees are not included in drag-drop.)
   - **`.tree` file via first-run modal:** the welcome modal on first launch accepts a `.tree` file directly.
   - **`.tree` file via menu:** click **Import** in the menu and select your `.tree` file.

## Development

```bash
npm install
npm run dev      # local dev with hot reload
npm run test     # vitest run
npm run lint     # eslint
npm run build    # production build to .output/
```
