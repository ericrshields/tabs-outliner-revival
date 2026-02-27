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
 * 3. text/html <li>/<ul> structure — iteratively parsed into HierarchyJSO
 * 4. text/plain — try JSON.parse as last resort
 * 5. null (no recognized tree data)
 */
export function extractTreeFromDrag(dataTransfer: DataTransfer): string | null {
  // Debug: log available types and data sizes
  const types = Array.from(dataTransfer.types);
  console.log('[drag-import] extractTreeFromDrag called, types:', types);
  for (const type of types) {
    const data = dataTransfer.getData(type);
    console.log(`[drag-import] ${type}: ${data ? `${data.length} chars` : '(empty)'}`);
  }

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

    // 3. Parse <li>/<ul> HTML structure from legacy extension
    const hierarchy = parseHtmlTreeDrop(html);
    if (hierarchy) {
      console.log('[drag-import] Parsed HTML tree:', JSON.stringify(hierarchy).length, 'chars');
      return JSON.stringify(hierarchy);
    }

    console.log('[drag-import] HTML parsing returned null');
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

interface FlatNode {
  title: string;
  url: string | null;
  depth: number;
}

/**
 * Parse the legacy extension's <li>/<ul> HTML drag format into HierarchyJSO.
 *
 * The HTML is a flat sequence of tags — NOT properly nested HTML:
 *   <li>Session</li><ul><li>Window</li><ul><li><a href="...">Tab</a></li></ul></ul>
 *
 * We parse it as a token stream: <ul> increments depth, </ul> decrements,
 * and each <li>...</li> produces a node at the current depth. Then we
 * build a tree from the flat depth-annotated list.
 *
 * Uses DOMParser as a tag tokenizer only — we walk childNodes iteratively
 * without relying on the browser's HTML restructuring.
 */
function parseHtmlTreeDrop(html: string): HierarchyJSO | null {
  // Tokenize by tracking <ul> depth and collecting <li> content
  const nodes = tokenizeFromHtml(html);
  console.log('[drag-import] Tokenized nodes:', nodes.length, nodes.map(
    n => `d${n.depth}: ${n.url ? `[tab] ${n.title}` : `[${n.title}]`}`,
  ));
  if (nodes.length === 0) return null;
  const hierarchy = buildHierarchy(nodes);
  if (hierarchy) {
    const countJsoNodes = (h: HierarchyJSO): number =>
      1 + (h.s?.reduce((sum, c) => sum + countJsoNodes(c), 0) ?? 0);
    console.log('[drag-import] Built hierarchy:', countJsoNodes(hierarchy), 'nodes');
  }
  return hierarchy;
}

/**
 * Walk the HTML string as a tag stream. Track depth via <ul>/<\/ul> tags.
 * Extract node data from each <li>...</li> span.
 */
function tokenizeFromHtml(html: string): FlatNode[] {
  const nodes: FlatNode[] = [];
  let depth = 0;

  // Match opening/closing tags for ul, li, a
  const tagRe = /<(\/?)(\w+)([^>]*)>/g;
  let m: RegExpExecArray | null;
  let inLi = false;
  let liDepth = 0;
  let currentUrl: string | null = null;
  let currentTitle = '';

  while ((m = tagRe.exec(html)) !== null) {
    const isClose = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? '';

    if (tag === 'ul') {
      if (isClose) depth--;
      else depth++;
    } else if (tag === 'li') {
      if (isClose) {
        if (inLi) {
          nodes.push({ title: currentTitle.trim(), url: currentUrl, depth: liDepth });
          inLi = false;
        }
      } else {
        inLi = true;
        liDepth = depth;
        currentUrl = null;
        currentTitle = '';
        // Grab direct text between <li> and the next tag
        const afterTag = html.substring(m.index + m[0].length);
        const nextTagIdx = afterTag.indexOf('<');
        if (nextTagIdx > 0) {
          currentTitle = afterTag.substring(0, nextTagIdx);
        }
      }
    } else if (tag === 'a' && !isClose && inLi) {
      const hrefMatch = /href="([^"]*)"/.exec(attrs);
      if (hrefMatch) currentUrl = hrefMatch[1];
      // Text between <a...> and </a>
      const afterTag = html.substring(m.index + m[0].length);
      const closeIdx = afterTag.indexOf('</a>');
      if (closeIdx !== -1) {
        currentTitle = afterTag.substring(0, closeIdx);
      }
    }
  }

  return nodes;
}

function buildHierarchy(nodes: FlatNode[]): HierarchyJSO | null {
  if (nodes.length === 0) return null;

  function buildSubtree(index: number): { jso: HierarchyJSO; nextIndex: number } {
    const node = nodes[index];
    const children: HierarchyJSO[] = [];

    let i = index + 1;
    while (i < nodes.length && nodes[i].depth > node.depth) {
      if (nodes[i].depth === node.depth + 1) {
        const result = buildSubtree(i);
        children.push(result.jso);
        i = result.nextIndex;
      } else {
        i++;
      }
    }

    const serialized = toSerializedNode(node, children.length > 0);

    return {
      jso: children.length > 0
        ? { n: serialized, s: children }
        : { n: serialized },
      nextIndex: i,
    };
  }

  const root = buildSubtree(0);

  // If the dragged root is already a session, return as-is
  if (isSessionTitle(nodes[0].title)) {
    return root.jso;
  }

  // Otherwise, wrap in a session so the tree has the right root type.
  // The dragged subtree (window, group, or tabs) becomes a child.
  const sessionNode: SerializedNode = {
    type: 'session',
    data: { treeId: `imported-${Date.now()}`, nextDId: 1, nonDumpedDId: 1 },
  };
  return { n: sessionNode, s: [root.jso] };
}

/** Detect session root by title convention. */
function isSessionTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return lower === 'current session' || lower.includes('session');
}

/**
 * Convert a parsed node to a SerializedNode based on content, not position.
 * - URL present → saved tab
 * - "Current Session" title → session root
 * - Has children, no URL → saved window (title preserved in marks)
 * - Leaf without URL → text note
 */
function toSerializedNode(
  node: FlatNode,
  hasChildren: boolean,
): SerializedNode {
  // Session root detected by title
  if (isSessionTitle(node.title) && !node.url && hasChildren) {
    return {
      type: 'session',
      data: { treeId: `imported-${Date.now()}`, nextDId: 1, nonDumpedDId: 1 },
    };
  }

  if (node.url) {
    return { data: { url: node.url, title: node.title || undefined } };
  }

  if (hasChildren) {
    return {
      type: 'savedwin',
      data: {},
      marks: node.title ? { relicons: [], customTitle: node.title } : undefined,
    };
  }

  return {
    type: 'textnote',
    data: { note: node.title || '' },
  };
}
