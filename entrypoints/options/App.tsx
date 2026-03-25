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
              checked={settings.autoScrollToTab}
              onChange={(e) =>
                handleChange(
                  'autoScrollToTab',
                  (e.target as HTMLInputElement).checked,
                )
              }
            />
            <span style={styles.labelText}>
              Auto-scroll tree to active tab
              <span style={styles.labelDesc}>
                Automatically scroll the tree to keep the current tab in view.
              </span>
            </span>
          </label>
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
                Automatically open the Tabs Outliner window when the browser
                starts.
              </span>
            </span>
          </label>
          <label style={styles.row}>
            <input
              type="checkbox"
              checked={settings.oneClickToOpen}
              onChange={(e) =>
                handleChange(
                  'oneClickToOpen',
                  (e.target as HTMLInputElement).checked,
                )
              }
            />
            <span style={styles.labelText}>
              One-click to open tabs
              <span style={styles.labelDesc}>
                Open saved tabs with a single click instead of double-click.
              </span>
            </span>
          </label>
        </section>

        {/* Appearance */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Appearance</h2>
          <label style={styles.row}>
            <input
              type="checkbox"
              checked={settings.lightBackground}
              onChange={(e) =>
                handleChange(
                  'lightBackground',
                  (e.target as HTMLInputElement).checked,
                )
              }
            />
            <span style={styles.labelText}>
              Light background
              <span style={styles.labelDesc}>
                Use a light theme instead of the default dark background.
              </span>
            </span>
          </label>
        </section>

        {/* Backup */}
        <section style={{ ...styles.section, ...styles.disabled }}>
          <h2 style={{ ...styles.sectionTitle, color: '#aaa' }}>
            Google Drive Backup
          </h2>
          <p style={styles.comingSoon}>
            Cloud backup via Google Drive is coming in a future update.
          </p>
        </section>

        {/* About */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>About</h2>
          <p style={styles.aboutText}>
            Tabs Outliner Revival &mdash; version {version}
          </p>
          <p style={styles.aboutText}>
            A community revival of the original Tabs Outliner by Vladyslav
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
    background: '#f5f5f5',
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
    color: '#1a1a2e',
    marginBottom: '24px',
  },
  section: {
    background: '#ffffff',
    borderRadius: '8px',
    padding: '20px 24px',
    marginBottom: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  disabled: {
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: '#555',
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
    color: '#222',
    lineHeight: '1.4',
  },
  labelDesc: {
    fontSize: '12px',
    color: '#888',
    marginTop: '2px',
    fontWeight: 400,
  },
  comingSoon: {
    fontSize: '13px',
    color: '#888',
    margin: 0,
  },
  aboutText: {
    fontSize: '13px',
    color: '#555',
    margin: '0 0 6px',
    lineHeight: '1.5',
  },
  link: {
    color: '#3b4a8c',
  },
};
