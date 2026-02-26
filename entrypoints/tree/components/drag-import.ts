/** Legacy extension's custom MIME type for cross-instance tree interchange. */
const TABS_OUTLINER_MIME = 'application/x-tabsoutliner-items';

/** Marker for embedded JSON in legacy extension's text/html drag data. */
const HTML_DATA_BEGIN = '<!--tabsoutlinerdata:begin';
const HTML_DATA_END = 'tabsoutlinerdata:end-->';

/**
 * Extract tree JSON from a DnD dataTransfer.
 *
 * Priority:
 * 1. application/x-tabsoutliner-items — full HierarchyJSO from legacy extension
 * 2. text/html with embedded <!--tabsoutlinerdata:begin...end--> comment
 *    (may not start at position 0 — search for marker anywhere in HTML)
 * 3. text/plain — try JSON.parse as last resort
 * 4. null (no recognized tree data in the drag)
 */
export function extractTreeFromDrag(dataTransfer: DataTransfer): string | null {
  // Log available types for debugging cross-extension DnD
  const types = Array.from(dataTransfer.types);
  if (types.length > 0) {
    console.log('[drag-import] Available types:', types);
    for (const type of types) {
      const data = dataTransfer.getData(type);
      console.log(`[drag-import] ${type}: ${data ? `${data.length} chars` : '(empty)'}`);
    }
  }

  // 1. Custom MIME type (backup view or direct drag)
  const tabsOutlinerData = dataTransfer.getData(TABS_OUTLINER_MIME);
  if (tabsOutlinerData) return tabsOutlinerData;

  // 2. HTML with embedded JSON (inter-instance transfers)
  // Search for marker anywhere in the HTML, not just at the start
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
  }

  // 3. text/plain — try JSON.parse as last resort
  const plain = dataTransfer.getData('text/plain');
  if (plain) {
    try {
      JSON.parse(plain);
      // If it parses as JSON, it might be tree data
      return plain;
    } catch {
      // Not JSON — ignore
    }
  }

  return null;
}
