/**
 * Deserialization — HierarchyJSO → TreeNode tree.
 *
 * Port of legacy treemodel.js deserializeNode + recursive tree restore.
 * Uses normalizeSerializedNode() from the serialization layer to handle
 * legacy mangled marks.
 */

import { NodeTypesEnum } from '../types/enums';
import type { NodeType } from '../types/enums';
import type { SessionData, TabData, WindowData, TextNoteData, SeparatorData } from '../types/node-data';
import type { HierarchyJSO, SerializedNode } from '../types/serialized';
import { normalizeSerializedNode } from '../serialization/hierarchy-jso';
import { TreeNode } from './tree-node';
import { SessionTreeNode } from './nodes/session-node';
import { TabTreeNode } from './nodes/tab-node';
import { SavedTabTreeNode } from './nodes/saved-tab-node';
import { WaitingTabTreeNode } from './nodes/waiting-tab-node';
import { AttachWaitTabTreeNode } from './nodes/attach-wait-tab-node';
import { WindowTreeNode } from './nodes/window-node';
import { SavedWindowTreeNode } from './nodes/saved-window-node';
import { WaitingWindowTreeNode } from './nodes/waiting-window-node';
import { GroupTreeNode } from './nodes/group-node';
import { TextNoteTreeNode } from './nodes/text-note-node';
import { SeparatorTreeNode } from './nodes/separator-node';

/**
 * Create a concrete TreeNode from a SerializedNode.
 *
 * Applies marks normalization, collapsed state, and diff IDs.
 * Returns null for unrecognized node types (matching legacy behavior).
 */
export function deserializeNode(raw: SerializedNode): TreeNode | null {
  // Normalize marks (handles legacy mangled field names)
  const serialized = normalizeSerializedNode(
    raw as unknown as Record<string, unknown>,
  );

  const type: NodeType =
    (serialized.type as NodeType | undefined) ?? NodeTypesEnum.SAVEDTAB;
  const data = serialized.data;

  let node: TreeNode;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- data is polymorphic from wire
  const d = data as any;

  switch (type) {
    case NodeTypesEnum.SESSION:
      node = new SessionTreeNode(d as Partial<SessionData>);
      break;
    case NodeTypesEnum.TAB:
      node = new TabTreeNode(d as TabData);
      break;
    case NodeTypesEnum.SAVEDTAB:
      node = new SavedTabTreeNode(d as TabData);
      break;
    case NodeTypesEnum.WAITINGTAB:
      node = new WaitingTabTreeNode(d as TabData);
      break;
    case NodeTypesEnum.ATTACHWAITINGTAB:
      node = new AttachWaitTabTreeNode(d as TabData);
      break;
    case NodeTypesEnum.WINDOW:
      node = new WindowTreeNode(d as WindowData);
      break;
    case NodeTypesEnum.SAVEDWINDOW:
      node = new SavedWindowTreeNode(d as WindowData);
      break;
    case NodeTypesEnum.WAITINGWINDOW:
      node = new WaitingWindowTreeNode(d as WindowData);
      break;
    case NodeTypesEnum.GROUP:
      node = new GroupTreeNode();
      break;
    case NodeTypesEnum.TEXTNOTE:
      node = new TextNoteTreeNode(d as TextNoteData);
      break;
    case NodeTypesEnum.SEPARATORLINE:
      node = new SeparatorTreeNode(d as SeparatorData);
      break;
    default:
      return null;
  }

  // Apply collapsed state
  node.colapsed = !!serialized.colapsed;

  // Apply normalized marks
  if (serialized.marks) {
    node.marks = serialized.marks;
  }

  node.calculateIsProtectedFromGoneOnClose();

  // Apply diff IDs
  if (serialized.dId) node.dId = serialized.dId;
  if (serialized.cdId) node.cdId = serialized.cdId;
  if (serialized.sdId) node.sdId = serialized.sdId;
  if (serialized.sdIdKnot) node.sdIdKnot = serialized.sdIdKnot as string;

  return node;
}

/**
 * Recursively build a TreeNode tree from a HierarchyJSO.
 *
 * Returns null if the root node cannot be deserialized.
 */
export function restoreTree(jso: HierarchyJSO): TreeNode | null {
  const node = deserializeNode(jso.n);
  if (!node) return null;

  if (jso.s) {
    for (let i = 0; i < jso.s.length; i++) {
      const child = restoreTree(jso.s[i]);
      if (child) {
        node.insertSubnode(i, child);
      }
    }
  }

  return node;
}
