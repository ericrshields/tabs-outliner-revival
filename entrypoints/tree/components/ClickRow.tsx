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
  const { singleClickActivation } = useContext(TreeContext);

  return (
    <div
      {...attrs}
      ref={innerRef}
      onFocus={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.metaKey) {
          node.isSelected ? node.deselect() : node.selectMulti();
        } else if (e.shiftKey) {
          node.selectContiguous();
        } else {
          node.select();
          // e.detail === 1 filters out the second click of a double-click,
          // preventing duplicate activate() calls (and duplicate tab opens).
          if (singleClickActivation && e.detail === 1) node.activate();
        }
      }}
      onDoubleClick={() => {
        if (!singleClickActivation) node.activate();
      }}
    >
      {children}
    </div>
  );
}
