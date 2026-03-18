import { describe, it, expect } from 'vitest';
import { importContainsTabs } from './drag-import';

describe('importContainsTabs', () => {
  it('returns true for HierarchyJSO with savedtab children (no type field)', () => {
    const json = JSON.stringify({
      n: { type: 'session', data: {} },
      s: [
        {
          n: { type: 'savedwin', data: {} },
          s: [
            { n: { data: { url: 'https://example.com', title: 'Example' } } },
          ],
        },
      ],
    });
    expect(importContainsTabs(json)).toBe(true);
  });

  it('returns true for HierarchyJSO with explicit tab type children', () => {
    const json = JSON.stringify({
      n: { type: 'session', data: {} },
      s: [
        {
          n: { type: 'win', data: {} },
          s: [{ n: { type: 'tab', data: { url: 'https://example.com' } } }],
        },
      ],
    });
    expect(importContainsTabs(json)).toBe(true);
  });

  it('returns false for HierarchyJSO with only window/session nodes and no tabs', () => {
    const json = JSON.stringify({
      n: { type: 'session', data: {} },
      s: [
        { n: { type: 'savedwin', data: {} } },
        { n: { type: 'savedwin', data: {} } },
      ],
    });
    expect(importContainsTabs(json)).toBe(false);
  });

  it('returns false for a single window node with no children', () => {
    const json = JSON.stringify({
      n: { type: 'savedwin', data: {} },
    });
    expect(importContainsTabs(json)).toBe(false);
  });

  it('returns true for operations log format (array with entries)', () => {
    const json = JSON.stringify([[1, { type: 'tab', data: {} }, [0, 1]]]);
    expect(importContainsTabs(json)).toBe(true);
  });

  it('returns true for unparseable JSON (let backend handle errors)', () => {
    expect(importContainsTabs('not valid json {')).toBe(true);
  });

  it('returns true for empty object (ambiguous data — do not warn)', () => {
    expect(importContainsTabs('{}')).toBe(true);
  });

  it('returns false for session with only non-tab types', () => {
    const json = JSON.stringify({
      n: { type: 'session', data: {} },
      s: [
        { n: { type: 'group', data: {} } },
        { n: { type: 'textnote', data: { note: 'hello' } } },
        { n: { type: 'separatorline', data: {} } },
      ],
    });
    expect(importContainsTabs(json)).toBe(false);
  });

  it('returns true when tabs are deeply nested', () => {
    const json = JSON.stringify({
      n: { type: 'session', data: {} },
      s: [
        {
          n: { type: 'savedwin', data: {} },
          s: [
            {
              n: { type: 'group', data: {} },
              s: [{ n: { type: 'waitingtab', data: {} } }],
            },
          ],
        },
      ],
    });
    expect(importContainsTabs(json)).toBe(true);
  });
});
