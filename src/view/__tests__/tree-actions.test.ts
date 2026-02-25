import { describe, it, expect } from 'vitest';
import {
  requestTree,
  activateNode,
  toggleCollapse,
  executeAction,
  notifyUnload,
} from '../tree-actions';

describe('tree-actions', () => {
  describe('requestTree', () => {
    it('returns a get_tree_structure request', () => {
      const msg = requestTree();
      expect(msg).toEqual({ request: 'request2bkg_get_tree_structure' });
    });
  });

  describe('activateNode', () => {
    it('returns an activateNode request with the target id', () => {
      const msg = activateNode('idmvc42');
      expect(msg).toEqual({
        request: 'request2bkg_activateNode',
        targetNodeIdMVC: 'idmvc42',
      });
    });
  });

  describe('toggleCollapse', () => {
    it('returns an invertCollapsedState request with the target id', () => {
      const msg = toggleCollapse('win1');
      expect(msg).toEqual({
        request: 'request2bkg_invertCollapsedState',
        targetNodeIdMVC: 'win1',
      });
    });
  });

  describe('executeAction', () => {
    it('returns a hovering menu action request', () => {
      const msg = executeAction('tab5', 'closeAction');
      expect(msg).toEqual({
        request: 'request2bkg_activateHoveringMenuActionOnNode',
        targetNodeIdMVC: 'tab5',
        actionId: 'closeAction',
      });
    });
  });

  describe('notifyUnload', () => {
    it('returns a beforeUnload save request', () => {
      const msg = notifyUnload();
      expect(msg).toEqual({
        request: 'request2bkg_onViewWindowBeforeUnload_saveNow',
      });
    });
  });
});
