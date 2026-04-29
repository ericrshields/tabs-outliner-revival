/**
 * Custom DnD drag preview rendered while the user drags a tree node.
 *
 * react-arborist suppresses the browser's default drag image (via
 * `getEmptyImage()`) and forwards the drag state to whatever component is
 * passed as `renderDragPreview`. This component takes that state and
 * paints a minimal "moving" visual at the cursor: the dragged node's row
 * plus a depth-aware glimpse of its descendants, faded with a horizontal
 * mask gradient that trails off into transparency on the right edge —
 * the legacy extension's "cut off" effect.
 *
 * Multi-drag isn't fully wired through the rest of the app yet (App.tsx
 * warns and only moves the first node), but we still surface the count
 * badge for forward compatibility.
 */

import type { TreeApi, DragPreviewProps } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';

/** Upper bound on previewed descendant rows (the dragged container itself
 * is always shown in addition). Keeps the floating stack visually compact
 * and prevents huge subtrees from filling half the viewport. */
const MAX_DESCENDANT_ROWS = 6;

const ROW_INDENT_PX = 16;
const ROW_BASE_PAD_PX = 8;

export interface MakeDragPreviewOptions {
  /** Ref to the tree API so we can resolve the dragged node's DTO at render time. */
  treeRef: React.RefObject<TreeApi<NodeDTO> | null>;
}

interface FlatRow {
  data: NodeDTO;
  depth: number;
}

/** Pre-order walk; pushes each node with its depth relative to the
 * dragged container (depth 1 = direct child, etc.). Stops once `acc`
 * reaches `limit` so we don't allocate for nodes we won't render. */
function flattenWithLimit(
  nodes: readonly NodeDTO[],
  depth: number,
  limit: number,
  acc: FlatRow[],
): void {
  for (const n of nodes) {
    if (acc.length >= limit) return;
    acc.push({ data: n, depth });
    if (n.subnodes && n.subnodes.length > 0) {
      flattenWithLimit(n.subnodes, depth + 1, limit, acc);
    }
  }
}

function countDescendants(nodes: readonly NodeDTO[]): number {
  let total = 0;
  for (const n of nodes) {
    total++;
    if (n.subnodes && n.subnodes.length > 0) {
      total += countDescendants(n.subnodes);
    }
  }
  return total;
}

interface RowProps {
  data: Pick<NodeDTO, 'icon' | 'nodeText'>;
  depth: number;
}

function PreviewRow({ data, depth }: RowProps) {
  const className =
    depth === 0
      ? 'drag-preview-row'
      : 'drag-preview-row drag-preview-row--child';
  return (
    <div
      className={className}
      style={{ paddingLeft: ROW_BASE_PAD_PX + depth * ROW_INDENT_PX }}
    >
      {data.icon ? <img className="node-icon" src={data.icon} alt="" /> : null}
      <span className="drag-preview-text">{data.nodeText}</span>
    </div>
  );
}

/**
 * Factory: closes over `treeRef` so the rendered component can read live
 * node data without going through react-arborist's internal `useTreeApi`
 * (not part of its public surface).
 */
export function makeDragPreview({ treeRef }: MakeDragPreviewOptions) {
  return function DragPreview({
    mouse,
    id,
    dragIds,
    isDragging,
  }: DragPreviewProps) {
    if (!isDragging || !mouse || !id) return null;
    const node = treeRef.current?.get(id);
    const data = node?.data;
    if (!data) return null;

    const allChildren = data.subnodes ?? [];
    const flat: FlatRow[] = [];
    flattenWithLimit(allChildren, 1, MAX_DESCENDANT_ROWS, flat);
    const overflow = countDescendants(allChildren) - flat.length;
    const overflowDepth = flat.length > 0 ? flat[flat.length - 1].depth : 1;

    return (
      <div className="drag-preview-overlay">
        <div
          className="drag-preview-stack"
          style={{ transform: `translate(${mouse.x}px, ${mouse.y}px)` }}
        >
          <PreviewRow data={data} depth={0} />
          {flat.map((row) => (
            <PreviewRow
              key={row.data.idMVC}
              data={row.data}
              depth={row.depth}
            />
          ))}
          {overflow > 0 ? (
            <div
              className="drag-preview-row drag-preview-row--more"
              style={{
                paddingLeft: ROW_BASE_PAD_PX + overflowDepth * ROW_INDENT_PX,
              }}
            >
              +{overflow} more
            </div>
          ) : null}
        </div>
        {dragIds.length > 1 ? (
          <div
            className="drag-preview-count"
            style={{
              transform: `translate(${mouse.x + 10}px, ${mouse.y + 10}px)`,
            }}
          >
            {dragIds.length}
          </div>
        ) : null}
      </div>
    );
  };
}
