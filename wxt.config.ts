import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  // @preact/preset-vite handles JSX transform and react → preact/compat aliasing.
  // To eject to React: replace this with @vitejs/plugin-react and remove preact deps.
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: {
    name: 'Tabs Outliner Revival',
    description:
      'The Next Generation Session Manager; A Really Working Too Many Open Tabs Solution; And Your Browsing Notebook.',
    version: '2.0.0',
    permissions: [
      'storage',
      'tabs',
      'unlimitedStorage',
      'favicon',
      'identity',
      'system.display',
    ],
    optional_permissions: [
      'identity.email',
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
        extension_ids: ['*'],
      },
    ],
    default_locale: 'en',
    offline_enabled: true,
  },
});
