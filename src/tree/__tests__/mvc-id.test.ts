import { describe, it, expect, beforeEach } from 'vitest';
import { generateMvcId, resetMvcIdCounter } from '../mvc-id';

describe('generateMvcId', () => {
  beforeEach(() => {
    resetMvcIdCounter();
  });

  it('produces IDs in "idmvc" + counter format', () => {
    expect(generateMvcId()).toBe('idmvc1');
    expect(generateMvcId()).toBe('idmvc2');
    expect(generateMvcId()).toBe('idmvc3');
  });

  it('produces unique IDs across calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateMvcId());
    }
    expect(ids.size).toBe(100);
  });

  it('returns branded MvcId type', () => {
    const id = generateMvcId();
    // At runtime it's a string — verify the format
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^idmvc\d+$/);
  });
});

describe('resetMvcIdCounter', () => {
  it('resets counter to 1 by default', () => {
    generateMvcId(); // idmvc1
    generateMvcId(); // idmvc2
    resetMvcIdCounter();
    expect(generateMvcId()).toBe('idmvc1');
  });

  it('resets counter to a custom value', () => {
    resetMvcIdCounter(42);
    expect(generateMvcId()).toBe('idmvc42');
    expect(generateMvcId()).toBe('idmvc43');
  });
});
