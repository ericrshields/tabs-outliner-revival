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
 * 3. text/html <ul>/<li> structure — parsed into HierarchyJSO
 * 4. text/plain — try JSON.parse as last resort
 * 5. null (no recognized tree data)
 */
export function extractTreeFromDrag(dataTransfer: DataTransfer): string | null {
  // 1. Custom MIME type (same-origin only — blocked cross-extension)
  const tabsOutlinerData = dataTransfer.getData(TABS_OUTLINER_MIME);
  if (tabsOutlinerData) return tabsOutlinerData;

  // 2. HTML with embedded JSON comment
  const html = dataTransfer.getData('text/html');
  if (html) {
    const beginIdx = html.indexOf(HTML_DATA_BEGIN);
    if (beginIdx !== -1) {
      const jsonStart = beginIdx + HTML_DATA_BEGIN.length;
      const endIdx = html.indexOf(HTML_DATA_END, jsonStart);
      if (endIdx !== -1) {
        const jsonStr = html.substring(jsonStart, endIdx).trim();
        if (jsonStr) return jsonStr;
      }
    }

    // 3. Parse <ul>/<li> HTML structure from legacy extension
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

// -- HTML tree parser --

interface ParsedNode {
  title: string;
  url: string | null;
  depth: number;
}

/**
 * Parse the legacy extension's <ul>/<li> HTML drag format into HierarchyJSO.
 *
 * Format:
 *   <li>Current Session</li><ul>
 *     <li>Window</li><ul>
 *       <li><a href="url">title</a></li>
 *       ...
 *     </ul>
 *   </ul>
 *
 * Depth is tracked by <ul> (increment) and </ul> (decrement).
 * Nodes with <a href> are tabs; plain text nodes are windows/session/groups.
 */
function parseHtmlTreeDrop(html: string): HierarchyJSO | null {
  const nodes = tokenizeHtmlNodes(html);
  if (nodes.length === 0) return null;
  return buildHierarchy(nodes);
}

function tokenizeHtmlNodes(html: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  let depth = 0;
  let inLi = false;
  let currentTitle = '';
  let currentUrl: string | null = null;
  let currentDepth = 0;

  const tagRe = /<(\/?)(ul|li|a)(\s[^>]*)?\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html)) !== null) {
    const isClose = match[1] === '/';
    const tag = match[2].toLowerCase();
    const attrs = match[3] ?? '';

    if (tag === 'ul') {
      if (isClose) depth--;
      else depth++;
    } else if (tag === 'li') {
      if (isClose) {
        if (inLi) {
          nodes.push({
            title: currentTitle.trim(),
            url: currentUrl,
            depth: currentDepth,
          });
          inLi = false;
        }
      } else {
        inLi = true;
        currentTitle = '';
        currentUrl = null;
        currentDepth = depth;
        // Text between <li> and next tag
        const afterTag = html.substring(match.index + match[0].length);
        const nextTagIdx = afterTag.indexOf('<');
        if (nextTagIdx > 0) {
          currentTitle = afterTag.substring(0, nextTagIdx);
        }
      }
    } else if (tag === 'a' && !isClose && inLi) {
      const hrefMatch = /href="([^"]*)"/.exec(attrs);
      if (hrefMatch) currentUrl = hrefMatch[1];
      // Text between <a ...> and </a>
      const afterTag = html.substring(match.index + match[0].length);
      const closeIdx = afterTag.indexOf('</a>');
      if (closeIdx !== -1) {
        currentTitle = afterTag.substring(0, closeIdx);
      }
    }
  }

  return nodes;
}

function buildHierarchy(nodes: ParsedNode[]): HierarchyJSO | null {
  if (nodes.length === 0) return null;

  function buildSubtree(
    index: number,
    parentDepth: number,
  ): { jso: HierarchyJSO; nextIndex: number } {
    const node = nodes[index];
    const children: HierarchyJSO[] = [];

    let i = index + 1;
    while (i < nodes.length && nodes[i].depth > node.depth) {
      if (nodes[i].depth === node.depth + 1) {
        const result = buildSubtree(i, node.depth);
        children.push(result.jso);
        i = result.nextIndex;
      } else {
        // Skip deeper nodes (handled recursively)
        i++;
      }
    }

    const serialized = toSerializedNode(node, index === 0, children.length > 0);
    const jso: HierarchyJSO =
      children.length > 0
        ? { n: serialized, s: children }
        : { n: serialized };

    return { jso, nextIndex: i };
  }

  return buildSubtree(0, -1).jso;
}

function toSerializedNode(
  node: ParsedNode,
  isRoot: boolean,
  hasChildren: boolean,
): SerializedNode {
  if (isRoot) {
    return {
      type: 'session',
      data: { treeId: `imported-${Date.now()}`, nextDId: 1, nonDumpedDId: 1 },
    };
  }

  if (node.url) {
    // Tab (savedtab — type omitted means savedtab in our format)
    return {
      data: { url: node.url, title: node.title || undefined },
    };
  }

  // Window or group — nodes with children that aren't tabs
  if (hasChildren) {
    return {
      type: 'savedwin',
      data: {},
      marks: node.title ? { relicons: [], customTitle: node.title } : undefined,
    };
  }

  // Leaf without URL — text note
  return {
    type: 'textnote',
    data: { note: node.title },
  };
}
