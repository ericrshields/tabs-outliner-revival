import type { CSSProperties } from 'react';
import { browser } from 'wxt/browser';

export function App() {
  const manifest = browser.runtime.getManifest();

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badgeRow}>
          <span style={styles.flagBadge}>🇺🇦 Made in Ukraine</span>
          <span style={styles.flagBadge}>🇺🇸 Re-assembled in the US</span>
        </div>

        <h1 style={styles.title}>Tabs Outliner</h1>
        <p style={styles.subtitle}>Original extension by Vladyslav Volovyk</p>

        <hr style={styles.divider} />

        <section style={styles.section}>
          <p>
            Tabs Outliner was created by <strong>Vladyslav Volovyk</strong>, a
            Ukrainian developer. It first launched on 21 July 2012 and became an
            essential tool for thousands of users managing complex browsing
            sessions.
          </p>
          <p>
            Active development was quiet for over a decade, and we hope
            Vladyslav and his family are well.
          </p>
          <p>
            This revival project exists to keep his work alive and accessible,
            and to bring its spirit into the modern Chrome platform. We stand on
            the shoulders of the original — the design and concepts carry
            forward, while the codebase itself needed a fundamental overhaul to
            run on Manifest V3. All original copyright notices are preserved
            throughout the codebase.
          </p>
          <p>
            The original extension is still listed on the Chrome Web Store:{' '}
            <a
              href="https://chromewebstore.google.com/detail/tabs-outliner/eggkanocgddhmamlbiijnphhppkpkmkl"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              Tabs Outliner by Vladyslav Volovyk
            </a>
            .
          </p>
        </section>

        <div style={styles.note}>
          <strong>Note on the original payment link:</strong> The original
          extension used a FastSpring checkout that was dynamically generated —
          there is no static URL to link to here. If you&rsquo;d like to support
          Vladyslav directly, search for <em>Vladyslav Volovyk</em> or{' '}
          <em>tabsoutliner.com</em> to see if any contact or support options are
          available.
        </div>

        <hr style={styles.divider} />

        <div style={styles.footer}>
          <span style={styles.version}>
            {manifest.name} v{manifest.version_name ?? manifest.version}
          </span>
          <button
            style={styles.openBtn}
            onClick={() => {
              window.location.href = browser.runtime.getURL(
                '/tree.html' as Parameters<typeof browser.runtime.getURL>[0],
              );
            }}
          >
            Open Tabs Outliner
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#202020',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '24px',
  },
  card: {
    background: '#2a2a2a',
    borderRadius: '12px',
    maxWidth: '560px',
    width: '100%',
    padding: '40px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px',
  },
  flagBadge: {
    display: 'inline-block',
    background: '#1f2940',
    border: '1px solid #2f3d5e',
    borderRadius: '20px',
    padding: '4px 12px',
    fontSize: '13px',
    color: '#9cb7d3',
  },
  title: {
    margin: '0 0 4px',
    fontSize: '28px',
    fontWeight: 700,
    color: '#cce0f5',
  },
  subtitle: {
    margin: '0 0 20px',
    fontSize: '15px',
    color: '#7a9ab8',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #3a3a3a',
    margin: '20px 0',
  },
  section: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#c8d8e8',
  },
  note: {
    background: '#1f1f1f',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    padding: '14px 16px',
    fontSize: '13px',
    color: '#9cb7d3',
    lineHeight: '1.6',
    marginTop: '16px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  version: {
    fontSize: '12px',
    color: '#7a9ab8',
  },
  openBtn: {
    background: '#3b7bb8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 20px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  link: {
    color: '#6aa3d5',
  },
};
