import { describe, expect, it } from 'vitest';
import { NodeTypesEnum } from '../enums';
import type { MvcId } from '../brands';
import type { NodeModel } from '../node';
import type { NodeDTO } from '../node-dto';
import type { SerializedNode } from '../serialized';
import type { BackgroundToViewMessage } from '../messages';

/** Helper to create branded MvcId from string in tests */
const mvcId = (s: string) => s as MvcId;

/**
 * Compile-time type assertion tests.
 *
 * These tests verify that the type system correctly narrows
 * discriminated unions. If the types are wrong, the file won't compile.
 * The runtime assertions are minimal — the real value is compile-time checking.
 */

describe('NodeModel discriminated union', () => {
  it('narrows on type discriminant', () => {
    // Create a minimal node-like object to prove narrowing works
    const node = { type: NodeTypesEnum.TAB } as unknown as NodeModel;

    switch (node.type) {
      case NodeTypesEnum.TAB:
        // TypeScript narrows to TabNode here
        expect(node.type).toBe('tab');
        break;
      case NodeTypesEnum.SESSION:
        // TypeScript narrows to SessionNode here
        expect(node.type).toBe('session');
        break;
      default:
        // Other types are valid
        break;
    }
  });

  it('exhaustive switch compiles when all cases covered', () => {
    function getNodeLabel(node: NodeModel): string {
      switch (node.type) {
        case NodeTypesEnum.TAB:
          return 'tab';
        case NodeTypesEnum.SAVEDTAB:
          return 'savedtab';
        case NodeTypesEnum.WAITINGTAB:
          return 'waitingtab';
        case NodeTypesEnum.ATTACHWAITINGTAB:
          return 'attachwaitingtab';
        case NodeTypesEnum.WINDOW:
          return 'window';
        case NodeTypesEnum.SAVEDWINDOW:
          return 'savedwindow';
        case NodeTypesEnum.WAITINGWINDOW:
          return 'waitingwindow';
        case NodeTypesEnum.SESSION:
          return 'session';
        case NodeTypesEnum.TEXTNOTE:
          return 'textnote';
        case NodeTypesEnum.SEPARATORLINE:
          return 'separator';
        case NodeTypesEnum.GROUP:
          return 'group';
      }
    }

    // The function compiles without a default case,
    // proving TypeScript sees the switch as exhaustive
    expect(getNodeLabel).toBeDefined();
  });
});

describe('SerializedNode', () => {
  it('accepts valid shapes', () => {
    // Type absent means savedtab
    const savedTab: SerializedNode = {
      data: { url: 'https://example.com', title: 'Example' },
    };
    expect(savedTab.type).toBeUndefined();

    // Explicit type for non-savedtab
    const window: SerializedNode = {
      type: 'win',
      colapsed: true,
      data: { id: 1 },
    };
    expect(window.type).toBe('win');

    // With marks and diff IDs
    const withMarks: SerializedNode = {
      type: 'textnote',
      dId: 5,
      cdId: 3,
      marks: { relicons: [] },
      data: { note: 'hello' },
    };
    expect(withMarks.dId).toBe(5);
  });
});

describe('NodeDTO', () => {
  it('subnodes are recursive', () => {
    // This is a compile-time check — NodeDTO.subnodes is NodeDTO[]
    const dto: NodeDTO = {
      id: mvcId('idmvc1'),
      idMVC: mvcId('idmvc1'),
      colapsed: false,
      subnodes: [
        {
          id: mvcId('idmvc2'),
          idMVC: mvcId('idmvc2'),
          colapsed: false,
          subnodes: [],
          titleCssClass: 'tab',
          titleBackgroundCssClass: 'tabFrame',
          marks: { relicons: [] },
          customTitle: null,
          hoveringMenuActions: {},
          statsBlockData: null,
          icon: '',
          iconForHtmlExport: '',
          tooltipText: '',
          href: null,
          nodeText: '',
          isSelectedTab: false,
          isFocusedWindow: false,
          isProtectedFromGoneOnClose: false,
          nodeContentCssClass: '',
          nodeTextCustomStyle: null,
          isSubnodesPresent: false,
        },
      ],
      titleCssClass: 'win',
      titleBackgroundCssClass: 'windowFrame',
      marks: { relicons: [] },
      customTitle: null,
      hoveringMenuActions: {},
      statsBlockData: null,
      icon: '',
      iconForHtmlExport: '',
      tooltipText: '',
      href: null,
      nodeText: '',
      isSelectedTab: false,
      isFocusedWindow: false,
      isProtectedFromGoneOnClose: false,
      nodeContentCssClass: '',
      nodeTextCustomStyle: null,
      isSubnodesPresent: true,
    };

    expect(dto.subnodes).toHaveLength(1);
    expect(dto.subnodes[0].subnodes).toHaveLength(0);
  });
});

describe('BackgroundToViewMessage', () => {
  it('narrows on command discriminant', () => {
    const msg: BackgroundToViewMessage = {
      command: 'msg2view_setCursorHere',
      targetNodeIdMVC: 'idmvc42',
      doNotScrollView: false,
    };

    if (msg.command === 'msg2view_setCursorHere') {
      // TypeScript narrows to Msg_SetCursorHere
      expect(msg.targetNodeIdMVC).toBe('idmvc42');
      expect(msg.doNotScrollView).toBe(false);
    }
  });
});
