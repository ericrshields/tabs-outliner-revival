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
 * 3. null (no recognized tree data in the drag)
 */
export function extractTreeFromDrag(dataTransfer: DataTransfer): string | null {
  // 1. Custom MIME type (backup view or direct drag)
  const tabsOutlinerData = dataTransfer.getData(TABS_OUTLINER_MIME);
  if (tabsOutlinerData) return tabsOutlinerData;

  // 2. HTML with embedded JSON (inter-instance transfers)
  const html = dataTransfer.getData('text/html');
  if (html && html.startsWith(HTML_DATA_BEGIN)) {
    const endIdx = html.indexOf(HTML_DATA_END);
    if (endIdx !== -1) {
      const jsonStart = HTML_DATA_BEGIN.length;
      const jsonStr = html.substring(jsonStart, endIdx).trim();
      if (jsonStr) return jsonStr;
    }
  }

  return null;
}
