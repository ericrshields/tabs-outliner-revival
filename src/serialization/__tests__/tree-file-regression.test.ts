/**
 * Legacy .tree file regression suite.
 *
 * Pins the import pipeline (importTreeFile → restoreTree → TreeModel)
 * against representative fixtures. Any change to the wire format,
 * deserialize logic, or marks-normalization that breaks an existing
 * backup will fail one of the assertions below.
 *
 * Adding fixtures: prefer the literal-JSON-string approach used here
 * over external files — the JSON is the regression target and being
 * able to read it inline makes failures easy to diagnose.
 */

import { describe, it, expect } from 'vitest';
import { importTreeFile, exportTreeFile, countNodes } from '../hierarchy-jso';
import { TreeModel } from '@/tree/tree-model';
import { TreeNode } from '@/tree/tree-node';
import { NodeTypesEnum } from '@/types/enums';

/**
 * Comprehensive snapshot covering every saved-node type a user can
 * produce, plus marks (relicons, customTitle, customFavicon,
 * customColorSaved) and collapsed state.
 */
const ALL_NODE_TYPES_TREE = `
{
  "n": {
    "type": "session",
    "data": { "treeId": "tree-test-1", "nextDId": 50, "nonDumpedDId": 50 }
  },
  "s": [
    {
      "n": { "type": "savedwin", "data": {} },
      "s": [
        { "n": { "data": { "url": "https://example.com", "title": "Example" } } },
        {
          "n": {
            "data": { "url": "https://example.org", "title": "Org" },
            "marks": { "relicons": [], "customTitle": "Renamed Tab" }
          }
        }
      ]
    },
    {
      "n": {
        "type": "group",
        "data": null,
        "marks": {
          "relicons": [{ "src": "img/x.png", "w": 16, "h": 16 }],
          "customFavicon": "img/group-custom.png",
          "customColorSaved": "#a0e0ff"
        }
      },
      "s": [
        { "n": { "type": "textnote", "data": { "note": "## Reading list" } } },
        { "n": { "type": "separatorline", "data": { "separatorIndx": 1 } } }
      ]
    },
    {
      "n": { "type": "group", "data": null, "colapsed": true },
      "s": [
        { "n": { "data": { "url": "https://hidden.com", "title": "Hidden" } } }
      ]
    }
  ]
}
`;

/**
 * Same shape as a real legacy v0.4.28 export: marks use Closure
 * Compiler mangled field names (W → customTitle, I → customFavicon).
 * The deserialize path must normalize these on import.
 */
const LEGACY_MANGLED_MARKS_TREE = `
{
  "n": {
    "type": "session",
    "data": { "treeId": "tree-test-2", "nextDId": 10, "nonDumpedDId": 10 }
  },
  "s": [
    {
      "n": {
        "type": "group",
        "data": null,
        "marks": {
          "relicons": [],
          "W": "Renamed via Closure",
          "I": "img/closure.png"
        }
      },
      "s": [
        { "n": { "data": { "url": "https://a.com" } } }
      ]
    }
  ]
}
`;

/**
 * Legacy v0.4.27 mangled marks (J/u → customTitle/customFavicon)
 * plus the color marks (U/V → customColorActive/customColorSaved)
 * which the v0.4.28 fixture above doesn't exercise.
 */
const LEGACY_V427_AND_COLOR_MARKS_TREE = `
{
  "n": {
    "type": "session",
    "data": { "treeId": "tree-test-3", "nextDId": 5, "nonDumpedDId": 5 }
  },
  "s": [
    {
      "n": {
        "data": { "url": "https://b.com", "title": "B" },
        "marks": {
          "relicons": [],
          "J": "v0.4.27 title",
          "u": "img/v427.png",
          "U": "#ff0000",
          "V": "#00ff00"
        }
      }
    }
  ]
}
`;

describe('legacy .tree file regression', () => {
  describe('all-node-types fixture', () => {
    it('parses without error', () => {
      expect(() => importTreeFile(ALL_NODE_TYPES_TREE)).not.toThrow();
    });

    it('countNodes returns the expected total', () => {
      const hier = importTreeFile(ALL_NODE_TYPES_TREE);
      // session, savedwin, 2 savedtabs, group, textnote, separator, group, savedtab
      expect(countNodes(hier)).toBe(9);
    });

    it('TreeModel restoration produces every saved-node type in document order', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(ALL_NODE_TYPES_TREE),
      );
      const types: string[] = [];
      model.forEach((node) => types.push(node.type));
      expect(types).toEqual([
        NodeTypesEnum.SESSION,
        NodeTypesEnum.SAVEDWINDOW,
        NodeTypesEnum.SAVEDTAB,
        NodeTypesEnum.SAVEDTAB,
        NodeTypesEnum.GROUP,
        NodeTypesEnum.TEXTNOTE,
        NodeTypesEnum.SEPARATORLINE,
        NodeTypesEnum.GROUP,
        NodeTypesEnum.SAVEDTAB,
      ]);
    });

    it('preserves customTitle on a saved tab', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(ALL_NODE_TYPES_TREE),
      );
      const renamed = collect(
        model,
        (n) => n.marks.customTitle === 'Renamed Tab',
      );
      expect(renamed).toHaveLength(1);
      expect(renamed[0].type).toBe(NodeTypesEnum.SAVEDTAB);
    });

    it('preserves customFavicon, customColorSaved, and relicons on a group', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(ALL_NODE_TYPES_TREE),
      );
      const groups = collect(
        model,
        (n) =>
          n.type === NodeTypesEnum.GROUP &&
          n.marks.customFavicon === 'img/group-custom.png',
      );
      expect(groups).toHaveLength(1);
      expect(groups[0].marks.customColorSaved).toBe('#a0e0ff');
      expect(groups[0].marks.relicons).toEqual([
        { src: 'img/x.png', w: 16, h: 16 },
      ]);
    });

    it('preserves collapsed state on a group', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(ALL_NODE_TYPES_TREE),
      );
      const collapsed = collect(
        model,
        (n) => n.type === NodeTypesEnum.GROUP && n.colapsed,
      );
      expect(collapsed).toHaveLength(1);
    });

    it('preserves textnote content', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(ALL_NODE_TYPES_TREE),
      );
      const notes = collect(model, (n) => n.type === NodeTypesEnum.TEXTNOTE);
      expect(notes).toHaveLength(1);
      expect(notes[0].getNodeText()).toBe('## Reading list');
    });

    it('preserves separator style index', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(ALL_NODE_TYPES_TREE),
      );
      const seps = collect(
        model,
        (n) => n.type === NodeTypesEnum.SEPARATORLINE,
      );
      expect(seps).toHaveLength(1);
      // separatorIndx 1 selects the '====' style — verifies the index
      // survives import + maps through SeparatorTreeNode.
      expect(seps[0].getNodeContentCssClass()).toBe('a');
    });

    it('round-trips: TreeModel → JSON → TreeModel preserves node count and types', () => {
      const model1 = TreeModel.fromHierarchyJSO(
        importTreeFile(ALL_NODE_TYPES_TREE),
      );
      const exported = exportTreeFile(model1.toHierarchyJSO());
      const model2 = TreeModel.fromHierarchyJSO(importTreeFile(exported));

      const types1: string[] = [];
      const types2: string[] = [];
      model1.forEach((n) => types1.push(n.type));
      model2.forEach((n) => types2.push(n.type));
      expect(types2).toEqual(types1);
    });

    it('round-trips: marks survive a TreeModel cycle', () => {
      const model1 = TreeModel.fromHierarchyJSO(
        importTreeFile(ALL_NODE_TYPES_TREE),
      );
      const exported = exportTreeFile(model1.toHierarchyJSO());
      const model2 = TreeModel.fromHierarchyJSO(importTreeFile(exported));

      const renamed = collect(
        model2,
        (n) => n.marks.customTitle === 'Renamed Tab',
      );
      expect(renamed).toHaveLength(1);

      const customGroup = collect(
        model2,
        (n) => n.marks.customFavicon === 'img/group-custom.png',
      );
      expect(customGroup).toHaveLength(1);
      expect(customGroup[0].marks.customColorSaved).toBe('#a0e0ff');
      expect(customGroup[0].marks.relicons).toEqual([
        { src: 'img/x.png', w: 16, h: 16 },
      ]);
    });
  });

  describe('legacy mangled-marks fixture (Closure Compiler v0.4.28)', () => {
    it('imports without error', () => {
      expect(() => importTreeFile(LEGACY_MANGLED_MARKS_TREE)).not.toThrow();
    });

    it('normalizes W → customTitle and I → customFavicon during deserialize', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(LEGACY_MANGLED_MARKS_TREE),
      );
      const groups = collect(model, (n) => n.type === NodeTypesEnum.GROUP);
      expect(groups).toHaveLength(1);
      expect(groups[0].marks.customTitle).toBe('Renamed via Closure');
      expect(groups[0].marks.customFavicon).toBe('img/closure.png');
      // Mangled names should not survive normalization.
      const marksRecord = groups[0].marks as unknown as Record<string, unknown>;
      expect(marksRecord.W).toBeUndefined();
      expect(marksRecord.I).toBeUndefined();
    });

    it('re-export uses canonical mark names (mangled names do not leak back out)', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(LEGACY_MANGLED_MARKS_TREE),
      );
      const exported = exportTreeFile(model.toHierarchyJSO());
      expect(exported).not.toContain('"W"');
      expect(exported).not.toContain('"I"');
      expect(exported).toContain('customTitle');
      expect(exported).toContain('customFavicon');
    });
  });

  describe('legacy v0.4.27 + color marks fixture', () => {
    it('imports without error', () => {
      expect(() =>
        importTreeFile(LEGACY_V427_AND_COLOR_MARKS_TREE),
      ).not.toThrow();
    });

    it('normalizes J → customTitle and u → customFavicon during deserialize', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(LEGACY_V427_AND_COLOR_MARKS_TREE),
      );
      const tabs = collect(model, (n) => n.type === NodeTypesEnum.SAVEDTAB);
      expect(tabs).toHaveLength(1);
      expect(tabs[0].marks.customTitle).toBe('v0.4.27 title');
      expect(tabs[0].marks.customFavicon).toBe('img/v427.png');
    });

    it('normalizes U → customColorActive and V → customColorSaved during deserialize', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(LEGACY_V427_AND_COLOR_MARKS_TREE),
      );
      const tabs = collect(model, (n) => n.type === NodeTypesEnum.SAVEDTAB);
      expect(tabs).toHaveLength(1);
      expect(tabs[0].marks.customColorActive).toBe('#ff0000');
      expect(tabs[0].marks.customColorSaved).toBe('#00ff00');
    });

    it('re-export drops all mangled v0.4.27 + color mark names', () => {
      const model = TreeModel.fromHierarchyJSO(
        importTreeFile(LEGACY_V427_AND_COLOR_MARKS_TREE),
      );
      const exported = exportTreeFile(model.toHierarchyJSO());
      expect(exported).not.toContain('"J"');
      expect(exported).not.toContain('"u"');
      expect(exported).not.toContain('"U"');
      expect(exported).not.toContain('"V"');
      expect(exported).toContain('customTitle');
      expect(exported).toContain('customFavicon');
      expect(exported).toContain('customColorActive');
      expect(exported).toContain('customColorSaved');
    });
  });
});

function collect(
  model: TreeModel,
  predicate: (node: TreeNode) => boolean,
): TreeNode[] {
  const matches: TreeNode[] = [];
  model.forEach((n) => {
    if (predicate(n)) matches.push(n);
  });
  return matches;
}
