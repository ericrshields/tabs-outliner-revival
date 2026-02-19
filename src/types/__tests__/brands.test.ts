import { describe, expect, it } from 'vitest';
import type { DiffId, DiffIdStr, MvcId, NodeId } from '../brands';

describe('Branded types', () => {
  it('MvcId is string at runtime', () => {
    const id = 'idmvc42' as MvcId;
    expect(typeof id).toBe('string');
    expect(id).toBe('idmvc42');
  });

  it('NodeId is string at runtime', () => {
    const id = 'tab42' as NodeId;
    expect(typeof id).toBe('string');
    expect(id).toBe('tab42');
  });

  it('DiffId is number at runtime', () => {
    const id = 7 as DiffId;
    expect(typeof id).toBe('number');
    expect(id).toBe(7);
  });

  it('DiffIdStr is string at runtime', () => {
    const id = '1r' as DiffIdStr;
    expect(typeof id).toBe('string');
    // 63 in base-36 is "1r"
    expect(parseInt(id, 36)).toBe(63);
  });
});
