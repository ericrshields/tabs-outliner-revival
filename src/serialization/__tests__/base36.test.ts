import { describe, it, expect } from 'vitest';
import { i2s36, s2i36 } from '../base36';

describe('i2s36', () => {
  it('encodes 0', () => {
    expect(i2s36(0)).toBe('0');
  });

  it('encodes small integers', () => {
    expect(i2s36(1)).toBe('1');
    expect(i2s36(10)).toBe('a');
    expect(i2s36(35)).toBe('z');
  });

  it('encodes larger integers', () => {
    expect(i2s36(36)).toBe('10');
    expect(i2s36(100)).toBe('2s');
    expect(i2s36(10000)).toBe('7ps');
  });

  it('matches Number.toString(36)', () => {
    for (let i = 0; i < 1000; i++) {
      expect(i2s36(i)).toBe(i.toString(36));
    }
  });
});

describe('s2i36', () => {
  it('decodes 0', () => {
    expect(s2i36('0')).toBe(0);
  });

  it('decodes small values', () => {
    expect(s2i36('a')).toBe(10);
    expect(s2i36('z')).toBe(35);
    expect(s2i36('10')).toBe(36);
  });

  it('returns NaN for invalid input', () => {
    expect(s2i36('')).toBeNaN();
    expect(s2i36('!@#')).toBeNaN();
  });

  it('round-trips with i2s36', () => {
    for (let i = 0; i < 1000; i++) {
      expect(s2i36(i2s36(i))).toBe(i);
    }
  });
});
