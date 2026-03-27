import type { CSSProperties } from 'react';
import { browser } from 'wxt/browser';

export function App() {
  const manifest = browser.runtime.getManifest();

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.flagBadge}>🇺🇦 Made in Ukraine</div>

        <h1 style={styles.title}>Tabs Outliner</h1>
        <p style={styles.subtitle}>Original extension by Vladyslav Volovyk</p>

        <hr style={styles.divider} />

        <section style={styles.section}>
          <p>
            Tabs Outliner was created by <strong>Vladyslav Volovyk</strong>, a
            Ukrainian developer who built and maintained it from 2012 onward. It
            became an essential tool for thousands of users who rely on it to
            manage complex browsing sessions.
          </p>
          <p>
            Development went quiet around 2022 — coinciding with Russia&rsquo;s
            full-scale invasion of Ukraine. Vladyslav&rsquo;s whereabouts and
            wellbeing are unknown to us. We hope he and his family are safe.
          </p>
          <p>
            This revival project exists to keep his work alive and accessible.
            All original copyright notices are preserved throughout the
            codebase.
          </p>
          <p>
            The original extension is still listed on the Chrome Web Store:{' '}
            <a
              href="https://chromewebstore.google.com/detail/tabs-outliner/eggkanocgddhmamlbiijnphhppkpkmkl"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#3b4a8c' }}
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
            Tabs Outliner Revival v{manifest.version_name ?? manifest.version}
          </span>
          <button style={styles.closeBtn} onClick={() => window.close()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#1a1a2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '24px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    maxWidth: '560px',
    width: '100%',
    padding: '40px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  flagBadge: {
    display: 'inline-block',
    background: '#f0f4ff',
    border: '1px solid #c5d0f0',
    borderRadius: '20px',
    padding: '4px 12px',
    fontSize: '13px',
    color: '#3b4a8c',
    marginBottom: '16px',
  },
  title: {
    margin: '0 0 4px',
    fontSize: '28px',
    fontWeight: 700,
    color: '#1a1a2e',
  },
  subtitle: {
    margin: '0 0 20px',
    fontSize: '15px',
    color: '#666',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #e8e8e8',
    margin: '20px 0',
  },
  section: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#333',
  },
  note: {
    background: '#fafafa',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '14px 16px',
    fontSize: '13px',
    color: '#555',
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
    color: '#999',
  },
  closeBtn: {
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 20px',
    fontSize: '14px',
    cursor: 'pointer',
  },
};
