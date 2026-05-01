import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import { loadSettings, saveSettings } from '@/storage/settings-storage';
import type { AppSettings } from '@/types/settings';
import { SETTINGS_DEFAULTS } from '@/types/settings';

export function App() {
  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((s) => {
      if (!cancelled) {
        setSettings(s);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(key: keyof AppSettings, value: boolean): void {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    void saveSettings({ [key]: value });
  }

  const manifest = browser.runtime.getManifest();
  const version = manifest.version_name ?? manifest.version;

  if (!loaded) return null;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Tabs Outliner Options</h1>

        {/* Behavior */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Behavior</h2>
          <label style={styles.row}>
            <input
              type="checkbox"
              checked={settings.openOnStartup}
              onChange={(e) =>
                handleChange(
                  'openOnStartup',
                  (e.target as HTMLInputElement).checked,
                )
              }
            />
            <span style={styles.labelText}>
              Open on browser startup
              <span style={styles.labelDesc}>
                Automatically open the Tabs Outliner tree when the browser
                starts.
              </span>
            </span>
          </label>
          <label style={styles.row}>
            <input
              type="checkbox"
              checked={settings.wrapImportsInContainer}
              onChange={(e) =>
                handleChange(
                  'wrapImportsInContainer',
                  (e.target as HTMLInputElement).checked,
                )
              }
            />
            <span style={styles.labelText}>
              Wrap imports in a dated group
              <span style={styles.labelDesc}>
                Nest imported trees under a timestamped group so repeated
                imports stay separated. Disable to insert imported items
                directly into the tree. Warning: if using the import wrapper,
                deleting the wrapper will delete all items remaining inside of
                it.
              </span>
            </span>
          </label>
        </section>

        {/* Coming Soon */}
        <section style={{ ...styles.section, ...styles.comingSoonSection }}>
          <h2 style={styles.comingSoonTitle}>Coming Soon</h2>
          <p style={styles.comingSoon}>
            Light theme, auto-scroll tree to active tab, one-click to open saved
            tabs, Google Drive backup, and many more options to come.
          </p>
        </section>

        {/* About */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>About</h2>
          <p style={styles.aboutText}>
            {browser.runtime.getManifest().name} &mdash; version {version}
          </p>
          <p style={styles.aboutText}>
            A fan modernization of the original Tabs Outliner by Vladyslav
            Volovyk.{' '}
            <a
              href="https://github.com/ericrshields/tabs-outliner-revival"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              View on GitHub
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#202020',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '32px 16px',
  },
  container: {
    maxWidth: '520px',
    margin: '0 auto',
  },
  heading: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#cce0f5',
    marginBottom: '24px',
  },
  section: {
    background: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px 24px',
    marginBottom: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: '#7a9ab8',
    margin: '0 0 14px',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '12px',
    cursor: 'pointer',
  },
  labelText: {
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: '14px',
    color: '#c8d8e8',
    lineHeight: '1.4',
  },
  labelDesc: {
    fontSize: '12px',
    color: '#6a8a9a',
    marginTop: '2px',
    fontWeight: 400,
  },
  comingSoonSection: {
    background: '#26303a',
  },
  comingSoonTitle: {
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: '#7a9ab8',
    margin: '0 0 14px',
  },
  comingSoon: {
    fontSize: '13px',
    color: '#bcc8d6',
    margin: 0,
    lineHeight: '1.5',
  },
  aboutText: {
    fontSize: '13px',
    color: '#9cb7d3',
    margin: '0 0 6px',
    lineHeight: '1.5',
  },
  link: {
    color: '#6aa3d5',
  },
};
