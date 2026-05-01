import { fakeBrowser } from 'wxt/testing';

// fakeBrowser.runtime is a partial that omits getManifest. Provide a minimal
// stub mirroring the wxt.config.ts manifest so production code reading the
// manifest at runtime works in tests. Tests that need different values can
// override this per-test with vi.spyOn or by reassigning the function.
Object.assign(fakeBrowser.runtime, {
  getManifest: () => ({
    manifest_version: 3,
    name: 'Tabs Outliner - Fan Modernization',
    version: '2.0.2.1',
  }),
});
