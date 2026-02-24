import { resolve } from 'path';
import { existsSync } from 'fs';
import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

function pathAliasPlugin() {
  const srcDir = resolve(__dirname, 'src');
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', ''];

  function tryResolve(source: string): string | undefined {
    if (!source.startsWith('@/')) return;
    const base = resolve(srcDir, source.slice(2));
    for (const ext of extensions) {
      const candidate = base + ext;
      if (existsSync(candidate)) return candidate;
    }
    for (const ext of extensions) {
      const candidate = resolve(base, 'index' + ext);
      if (existsSync(candidate)) return candidate;
    }
  }

  return {
    name: 'path-alias',
    enforce: 'pre' as const,
    resolveId: {
      order: 'pre' as const,
      handler(source: string) {
        return tryResolve(source);
      },
    },
  };
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  // @preact/preset-vite handles JSX transform and react → preact/compat aliasing.
  // To eject to React: replace this with @vitejs/plugin-react and remove preact deps.
  vite: () => ({
    plugins: [pathAliasPlugin(), preact()],
  }),
  manifest: {
    name: 'Tabs Outliner Revival',
    description:
      'The Next Generation Session Manager; A Really Working Too Many Open Tabs Solution; And Your Browsing Notebook.',
    version: '2.0.0.0',
    version_name: '2.0.0-alpha.0',
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'",
    },
    permissions: ['alarms', 'storage', 'tabs', 'unlimitedStorage', 'favicon'],
    optional_permissions: [
      'identity',
      'identity.email',
      'system.display',
      'clipboardRead',
      'clipboardWrite',
    ],
    oauth2: {
      client_id:
        '264571147925-gl2i51b5j91lkd21gojr9jh06kp2gos3.apps.googleusercontent.com',
      scopes: ['https://www.googleapis.com/auth/drive.appdata'],
    },
    commands: {
      save_close_current_tab: {
        description: 'Save and Close current tab',
      },
      save_close_current_window: {
        description: 'Save and Close current window',
      },
      save_close_all_windows: {
        description: 'Save and Close all open windows',
      },
      _execute_action: {},
    },
    web_accessible_resources: [
      {
        resources: ['_favicon/*'],
        matches: ['<all_urls>'],
      },
    ],
    default_locale: 'en',
    offline_enabled: true,
  },
});
