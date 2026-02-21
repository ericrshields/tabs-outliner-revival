import { describe, it, expect, beforeEach } from 'vitest';
import { TreeModel } from '../../tree-model';
import { SessionTreeNode } from '../../nodes/session-node';
import { SavedWindowTreeNode } from '../../nodes/saved-window-node';
import { SavedTabTreeNode } from '../../nodes/saved-tab-node';
import { GroupTreeNode } from '../../nodes/group-node';
import { TextNoteTreeNode } from '../../nodes/text-note-node';
import { resetMvcIdCounter } from '../../mvc-id';
import { toNodeDTO } from '../../dto';

describe('Large tree performance', () => {
  beforeEach(() => resetMvcIdCounter());

  function buildLargeTree(nodeCount: number): TreeModel {
    const session = new SessionTreeNode({
      treeId: 'perf-test',
      nextDId: 1,
      nonDumpedDId: 1,
    });

    let created = 1; // session
    const windowCount = Math.floor(nodeCount / 20); // ~20 tabs per window

    for (let w = 0; w < windowCount && created < nodeCount; w++) {
      const win = new SavedWindowTreeNode({ id: w + 1 });
      session.insertSubnode(-1, win);
      created++;

      const tabsInWindow = Math.min(18, nodeCount - created);
      for (let t = 0; t < tabsInWindow; t++) {
        const tab = new SavedTabTreeNode({
          url: `https://example${created}.com`,
          title: `Tab ${created}`,
        });
        win.insertSubnode(-1, tab);
        created++;
      }
    }

    // Fill remaining with groups/notes
    while (created < nodeCount) {
      if (created % 3 === 0) {
        session.insertSubnode(-1, new GroupTreeNode());
      } else {
        session.insertSubnode(-1, new TextNoteTreeNode({ note: `Note ${created}` }));
      }
      created++;
    }

    return new TreeModel(session);
  }

  it('builds and indexes 500+ node tree', () => {
    const start = performance.now();
    const model = buildLargeTree(500);
    const buildTime = performance.now() - start;

    let count = 0;
    model.forEach(() => count++);
    expect(count).toBeGreaterThanOrEqual(500);

    // Build should be reasonably fast (under 500ms even on slow CI)
    expect(buildTime).toBeLessThan(500);
  });

  it('serializes 500+ node tree', () => {
    const model = buildLargeTree(500);

    const start = performance.now();
    const jso = model.toHierarchyJSO();
    const serializeTime = performance.now() - start;

    expect(jso.s!.length).toBeGreaterThan(0);
    expect(serializeTime).toBeLessThan(500);
  });

  it('round-trips 500+ node tree', () => {
    const model = buildLargeTree(500);
    const jso = model.toHierarchyJSO();

    const start = performance.now();
    const restored = TreeModel.fromHierarchyJSO(jso);
    const restoreTime = performance.now() - start;

    let originalCount = 0;
    model.forEach(() => originalCount++);

    let restoredCount = 0;
    restored.forEach(() => restoredCount++);

    expect(restoredCount).toBe(originalCount);
    expect(restoreTime).toBeLessThan(500);
  });

  it('O(1) lookup in 500+ node tree', () => {
    const model = buildLargeTree(500);

    // Collect some node IDs
    const ids: string[] = [];
    model.forEach((node) => {
      if (ids.length < 50) ids.push(node.idMVC);
    });

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const id = ids[i % ids.length];
      model.findByMvcId(id as any);
    }
    const lookupTime = performance.now() - start;

    // 1000 lookups should be near-instant
    expect(lookupTime).toBeLessThan(50);
  });

  it('generates DTOs for 500+ node tree', () => {
    const model = buildLargeTree(500);

    const start = performance.now();
    const dto = toNodeDTO(model.root);
    const dtoTime = performance.now() - start;

    expect(dto.subnodes.length).toBeGreaterThan(0);
    expect(dtoTime).toBeLessThan(500);
  });

  it('handles mutations in large tree', () => {
    const model = buildLargeTree(500);
    const firstWin = model.root.subnodes[0];

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const tab = new SavedTabTreeNode({
        url: `https://new${i}.com`,
        title: `New ${i}`,
      });
      model.insertSubnode(firstWin, 0, tab);
    }
    const mutationTime = performance.now() - start;

    expect(firstWin.subnodes.length).toBeGreaterThanOrEqual(100);
    expect(mutationTime).toBeLessThan(500);
  });
});
