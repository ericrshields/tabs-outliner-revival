/**
 * HTML export serializer — produces `<li>/<ul>` HTML that round-trips
 * through the `parseHtmlTreeDrop` import parser in drag-import.ts.
 *
 * Format:
 *   <li><a href="URL">Title</a></li>    → tab (saved or active)
 *   <li>Title</li>                       → container (window, group, session)
 *   <li></li>                            → empty text note
 *   <ul>...</ul>                         → children wrapper
 */

import type { TreeNode } from '@/tree/tree-node';
import { NodeTypesEnum } from '@/types/enums';

/**
 * Encode HTML special characters — inverse of decodeEntities() in drag-import.ts.
 * Encodes &, <, >, ", and ' to their named/numeric entity forms.
 */
export function encodeEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Default labels for container types, avoiding date-decorated getNodeText(). */
const CONTAINER_DEFAULTS: Partial<Record<string, string>> = {
  [NodeTypesEnum.WINDOW]: 'Window',
  [NodeTypesEnum.SAVEDWINDOW]: 'Window',
  [NodeTypesEnum.WAITINGWINDOW]: 'Window',
  [NodeTypesEnum.GROUP]: 'Group',
};

/**
 * Get the display text for a node in HTML export.
 *
 * For session nodes, always emits "Current Session" to match
 * isSessionTitle() at import time — even if the session has
 * a customTitle mark.
 *
 * For tab nodes with href, always uses getNodeText() (page title).
 * The customTitle is preserved separately via data-custom-title attribute.
 *
 * For container nodes (windows, groups), uses marks.customTitle
 * with a static fallback to avoid date suffixes from getNodeText().
 *
 * For other nodes, falls through to getNodeText().
 */
function getDisplayText(node: TreeNode): string {
  if (node.type === NodeTypesEnum.SESSION) {
    return 'Current Session';
  }
  // Tabs: always use page title; customTitle is in data-custom-title attr
  if (node.getHref()) {
    return node.getNodeText();
  }
  if (node.marks.customTitle) {
    return node.marks.customTitle;
  }
  const containerDefault = CONTAINER_DEFAULTS[node.type];
  if (containerDefault) {
    return containerDefault;
  }
  return node.getNodeText();
}

/**
 * Serialize a tree to HTML `<li>/<ul>` format.
 *
 * Walks the tree recursively, emitting `<li>` for each node and
 * wrapping children in `<ul>...</ul>`. The output is compatible
 * with `parseHtmlTreeDrop()` for import round-trips.
 */
export function treeToHtml(root: TreeNode): string {
  return serializeNode(root);
}

function serializeNode(node: TreeNode): string {
  const href = node.getHref();
  const text = getDisplayText(node);
  const encodedText = encodeEntities(text);

  let li: string;
  if (href) {
    const customTitle = node.marks.customTitle;
    const customTitleAttr = customTitle
      ? ` data-custom-title="${encodeEntities(customTitle)}"`
      : '';
    li = `<li><a href="${encodeEntities(href)}"${customTitleAttr}>${encodedText}</a></li>`;
  } else if (node.type === NodeTypesEnum.TEXTNOTE) {
    // Text notes with content export as <li>text</li> (reimports as savedwin — accepted trade-off).
    // Empty text notes export as <li></li> (reimports as textnote).
    li = text ? `<li>${encodedText}</li>` : '<li></li>';
  } else {
    // Containers (session, window, savedwin, group) and separators
    li = `<li>${encodedText}</li>`;
  }

  if (node.subnodes.length === 0) {
    return li;
  }

  const childrenHtml = node.subnodes.map(serializeNode).join('');
  return `${li}<ul>${childrenHtml}</ul>`;
}
