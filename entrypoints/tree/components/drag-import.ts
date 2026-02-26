import type { HierarchyJSO } from '@/types/serialized';
import type { SerializedNode } from '@/types/serialized';

/** Legacy extension's custom MIME type for cross-instance tree interchange. */
const TABS_OUTLINER_MIME = 'application/x-tabsoutliner-items';

/** Marker for embedded JSON in legacy extension's text/html drag data. */
const HTML_DATA_BEGIN = '<!--tabsoutlinerdata:begin';
const HTML_DATA_END = 'tabsoutlinerdata:end-->';

/**
 * Extract tree JSON from a DnD dataTransfer.
 *
 * Priority:
 * 1. application/x-tabsoutliner-items — full HierarchyJSO (same-origin only)
 * 2. text/html with embedded <!--tabsoutlinerdata:begin...end--> comment
 * 3. text/html <ul>/<li> structure — parsed via DOMParser into HierarchyJSO
 * 4. text/plain — try JSON.parse as last resort
 * 5. null (no recognized tree data)
 */
export function extractTreeFromDrag(dataTransfer: DataTransfer): string | null {
  // 1. Custom MIME type (same-origin only — blocked cross-extension)
  const tabsOutlinerData = dataTransfer.getData(TABS_OUTLINER_MIME);
  if (tabsOutlinerData) return tabsOutlinerData;

  // 2–3. HTML formats
  const html = dataTransfer.getData('text/html');
  if (html) {
    // 2. Embedded JSON comment
    const beginIdx = html.indexOf(HTML_DATA_BEGIN);
    if (beginIdx !== -1) {
      const jsonStart = beginIdx + HTML_DATA_BEGIN.length;
      const endIdx = html.indexOf(HTML_DATA_END, jsonStart);
      if (endIdx !== -1) {
        const jsonStr = html.substring(jsonStart, endIdx).trim();
        if (jsonStr) return jsonStr;
      }
    }

    // 3. Parse <ul>/<li> structure via DOMParser
    const hierarchy = parseHtmlTreeDrop(html);
    if (hierarchy) {
      return JSON.stringify(hierarchy);
    }
  }

  // 4. text/plain — try JSON.parse as last resort
  const plain = dataTransfer.getData('text/plain');
  if (plain) {
    try {
      JSON.parse(plain);
      return plain;
    } catch {
      // Not JSON
    }
  }

  return null;
}

// -- HTML tree parser using DOMParser --

/**
 * Parse the legacy extension's <ul>/<li> HTML drag format into HierarchyJSO.
 *
 * The legacy extension serializes the tree as:
 *   <li>Current Session</li><ul>
 *     <li>Window</li><ul>
 *       <li><a href="url">title</a></li>
 *     </ul>
 *   </ul>
 *
 * DOMParser normalizes this into nested <li> elements with <ul> children.
 * We walk the resulting DOM to build a HierarchyJSO tree.
 */
function parseHtmlTreeDrop(html: string): HierarchyJSO | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // DOMParser wraps bare <li> elements in a <ul> or <body>.
  // Find the first <li> as the root.
  const rootLi = doc.querySelector('li');
  if (!rootLi) return null;

  return liToHierarchy(rootLi, true);
}

/**
 * Recursively convert a <li> DOM element into a HierarchyJSO node.
 *
 * Children are found in nested <ul> elements within the <li>.
 * Tabs are identified by having an <a> child with href.
 */
function liToHierarchy(li: Element, isRoot: boolean): HierarchyJSO {
  const children: HierarchyJSO[] = [];

  // Child <ul> elements contain child <li> nodes
  for (const ul of li.querySelectorAll(':scope > ul')) {
    for (const childLi of ul.querySelectorAll(':scope > li')) {
      children.push(liToHierarchy(childLi, false));
    }
  }

  const serialized = liToSerializedNode(li, isRoot, children.length > 0);

  return children.length > 0
    ? { n: serialized, s: children }
    : { n: serialized };
}

/**
 * Convert a single <li> element to a SerializedNode.
 *
 * - Root node → session
 * - <a href="url"> → saved tab
 * - Node with children → saved window (title in marks)
 * - Leaf without URL → text note
 */
function liToSerializedNode(
  li: Element,
  isRoot: boolean,
  hasChildren: boolean,
): SerializedNode {
  if (isRoot) {
    return {
      type: 'session',
      data: { treeId: `imported-${Date.now()}`, nextDId: 1, nonDumpedDId: 1 },
    };
  }

  const anchor = li.querySelector(':scope > a');
  if (anchor) {
    const url = anchor.getAttribute('href') ?? '';
    const title = anchor.textContent ?? '';
    return { data: { url, title: title || undefined } };
  }

  // Get direct text content (not from child elements)
  const title = getDirectTextContent(li);

  if (hasChildren) {
    return {
      type: 'savedwin',
      data: {},
      marks: title ? { relicons: [], customTitle: title } : undefined,
    };
  }

  return {
    type: 'textnote',
    data: { note: title || '' },
  };
}

/** Get text content directly owned by an element, excluding child elements. */
function getDirectTextContent(el: Element): string {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    }
  }
  return text.trim();
}
