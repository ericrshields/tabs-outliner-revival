import { describe, expect, it } from 'vitest';
import { NODE_TYPE_NUM2STR, NODE_TYPE_STR2NUM, NodeTypesEnum } from '../enums';

describe('NODE_TYPE_NUM2STR', () => {
  it('has ZERO at index 0', () => {
    expect(NODE_TYPE_NUM2STR[0]).toBe('ZERO');
  });

  it('has exactly 12 entries', () => {
    expect(NODE_TYPE_NUM2STR).toHaveLength(12);
  });

  it('maps critical indices to correct NodeType strings', () => {
    expect(NODE_TYPE_NUM2STR[1]).toBe(NodeTypesEnum.SESSION);
    expect(NODE_TYPE_NUM2STR[2]).toBe(NodeTypesEnum.TEXTNOTE);
    expect(NODE_TYPE_NUM2STR[3]).toBe(NodeTypesEnum.SEPARATORLINE);
    expect(NODE_TYPE_NUM2STR[4]).toBe(NodeTypesEnum.TAB);
    expect(NODE_TYPE_NUM2STR[5]).toBe(NodeTypesEnum.SAVEDTAB);
    expect(NODE_TYPE_NUM2STR[6]).toBe(NodeTypesEnum.GROUP);
    expect(NODE_TYPE_NUM2STR[7]).toBe(NodeTypesEnum.WINDOW);
    expect(NODE_TYPE_NUM2STR[8]).toBe(NodeTypesEnum.SAVEDWINDOW);
    expect(NODE_TYPE_NUM2STR[9]).toBe(NodeTypesEnum.ATTACHWAITINGTAB);
    expect(NODE_TYPE_NUM2STR[10]).toBe(NodeTypesEnum.WAITINGWINDOW);
    expect(NODE_TYPE_NUM2STR[11]).toBe(NodeTypesEnum.WAITINGTAB);
  });
});

describe('NODE_TYPE_STR2NUM', () => {
  it('round-trips all types through num->str->num', () => {
    for (let i = 0; i < NODE_TYPE_NUM2STR.length; i++) {
      const str = NODE_TYPE_NUM2STR[i];
      expect(NODE_TYPE_STR2NUM[str]).toBe(i);
    }
  });

  it('supports collapsed encoding (negative type index)', () => {
    // Legacy code encodes collapsed state as negative type number:
    // NodesTypesEnumStr2Num['tab'] * -1
    const tabIndex = NODE_TYPE_STR2NUM[NodeTypesEnum.TAB];
    expect(tabIndex).toBe(4);
    expect(tabIndex * -1).toBe(-4);
  });
});
