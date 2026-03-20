import { useContext } from 'react';
import type { RowRendererProps } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import { TreeContext } from './TreeContext';

/**
 * Custom row renderer replacing react-arborist's DefaultRow.
 *
 * DefaultRow calls node.activate() on every single click. This component
 * makes activation configurable: double-click by default, with an opt-in
 * single-click mode (legacy behavior) controlled via TreeContext.
 */
export function ClickRow({
  node,
  attrs,
  innerRef,
  children,
}: RowRendererProps<NodeDTO>) {
  const { singleClickActivation, editingId, onNodeClick } =
    useContext(TreeContext);

  return (
    <div
      {...attrs}
      ref={innerRef}
      onFocus={(e) => e.stopPropagation()}
      onClick={(e) => {
        // Suppress tree selection while any node is being inline-edited.
        // Without this, node.select() steals focus from the edit input.
        if (editingId) return;
        if (e.metaKey) {
          if (node.isSelected) {
            node.deselect();
          } else {
            node.selectMulti();
          }
        } else if (e.shiftKey) {
          node.selectContiguous();
        } else {
          onNodeClick(node.data.idMVC);
          node.select();
          // e.detail === 1 filters out the second click of a double-click,
          // preventing duplicate activate() calls (and duplicate tab opens).
          if (singleClickActivation && e.detail === 1) node.activate();
        }
      }}
      onDoubleClick={() => {
        if (editingId) return;
        if (!singleClickActivation) node.activate();
      }}
    >
      {children}
    </div>
  );
}
