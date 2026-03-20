/**
 * Tests for Epic 9 message constructors added to tree-actions.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  copyHierarchy,
  applyNodeTabText,
  applyNodeNoteText,
  applyNodeWindowText,
} from '../tree-actions';

describe('copyHierarchy', () => {
  it('builds a Req_CopyHierarchy message', () => {
    const msg = copyHierarchy('src1', 'parent1', 3);
    expect(msg).toEqual({
      request: 'request2bkg_copyHierarchy',
      sourceIdMVC: 'src1',
      targetParentIdMVC: 'parent1',
      targetPosition: 3,
    });
  });

  it('accepts null targetParentIdMVC (root-level paste)', () => {
    const msg = copyHierarchy('src1', null, 0);
    expect(msg.targetParentIdMVC).toBeNull();
  });

  it('accepts -1 targetPosition (last child)', () => {
    const msg = copyHierarchy('src1', 'p1', -1);
    expect(msg.targetPosition).toBe(-1);
  });
});

describe('applyNodeTabText', () => {
  it('builds a Req_OnOkAfterSetNodeTabText message', () => {
    const msg = applyNodeTabText('tab1', 'My custom title');
    expect(msg).toEqual({
      request: 'request2bkg_onOkAfterSetNodeTabTextPrompt',
      targetNodeIdMVC: 'tab1',
      newText: 'My custom title',
    });
  });

  it('allows empty string (clear custom title)', () => {
    const msg = applyNodeTabText('tab1', '');
    expect(msg.newText).toBe('');
  });
});

describe('applyNodeNoteText', () => {
  it('builds a Req_OnOkAfterSetNodeNoteText message', () => {
    const msg = applyNodeNoteText('note1', 'Updated note content');
    expect(msg).toEqual({
      request: 'request2bkg_onOkAfterSetNodeNoteTextPrompt',
      targetNodeIdMVC: 'note1',
      newText: 'Updated note content',
    });
  });
});

describe('applyNodeWindowText', () => {
  it('builds a Req_OnOkAfterSetNodeWindowText message', () => {
    const msg = applyNodeWindowText('win1', 'Work Windows');
    expect(msg).toEqual({
      request: 'request2bkg_onOkAfterSetNodeWindowTextPrompt',
      targetNodeIdMVC: 'win1',
      newText: 'Work Windows',
    });
  });
});
