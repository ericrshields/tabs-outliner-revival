import { resolve } from 'path';
import { existsSync } from 'fs';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

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

export default defineConfig({
  plugins: [pathAliasPlugin(), preact(), await WxtVitest()],
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'entrypoints/**/*.test.{ts,tsx}'],
  },
});
