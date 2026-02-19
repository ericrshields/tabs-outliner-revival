/**
 * Drag-and-drop types and MIME type constants.
 */

/**
 * Drop target descriptor.
 *
 * - `containerIdMVC`: the idMVC of the container node, or null for root
 * - `position`: numeric index (0 = first child, -1 = last child,
 *   positive integers for computed sibling indices)
 */
export interface DropTarget {
  readonly containerIdMVC: string | null;
  readonly position: number;
}

/**
 * MIME type constants used in drag-and-drop data transfer.
 *
 * These are runtime values used by the drag/drop system to identify
 * the type of data being transferred.
 */
export const DragMimeTypes = {
  /**
   * Prefix for the per-instance internal drag MIME type.
   * The actual MIME type is dynamically constructed at runtime:
   * `INSTANCE_PREFIX + instanceId + '-idmvc'`
   */
  INSTANCE_PREFIX: 'application/x-tabsoutliner-instaneid',
  /** Cross-instance TabsOutliner action link */
  ACTION_LINK: 'application/x-tabsoutliner-actionlink',
  /** Cross-instance TabsOutliner items (interchange format) */
  ITEMS: 'application/x-tabsoutliner-items',
  /** Standard URI list */
  URI_LIST: 'text/uri-list',
  /** Plain text */
  TEXT_PLAIN: 'text/plain',
  /** HTML content */
  TEXT_HTML: 'text/html',
} as const;

export type DragMimeType = (typeof DragMimeTypes)[keyof typeof DragMimeTypes];
