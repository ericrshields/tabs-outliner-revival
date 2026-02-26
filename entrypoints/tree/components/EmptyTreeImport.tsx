import { useRef, useState, useCallback } from 'react';
import type { DragEvent as ReactDragEvent, ChangeEvent } from 'react';
import type { ImportResultState } from '@/view/hooks/use-tree-data';

/** Legacy extension's custom MIME type for cross-instance tree interchange. */
const TABS_OUTLINER_MIME = 'application/x-tabsoutliner-items';

/** Marker for embedded JSON in legacy extension's text/html drag data. */
const HTML_DATA_BEGIN = '<!--tabsoutlinerdata:begin';
const HTML_DATA_END = 'tabsoutlinerdata:end-->';

export interface EmptyTreeImportProps {
  onImport: (json: string) => void;
  importResult: ImportResultState | null;
}

/**
 * Extract tree JSON from a DnD dataTransfer.
 *
 * Priority:
 * 1. application/x-tabsoutliner-items — full HierarchyJSO from legacy extension
 * 2. text/html with embedded <!--tabsoutlinerdata:begin...end--> comment
 * 3. null (no recognized tree data in the drag)
 */
function extractTreeFromDrag(dataTransfer: DataTransfer): string | null {
  // 1. Custom MIME type (backup view or direct drag)
  const tabsOutlinerData = dataTransfer.getData(TABS_OUTLINER_MIME);
  if (tabsOutlinerData) return tabsOutlinerData;

  // 2. HTML with embedded JSON (inter-instance transfers)
  const html = dataTransfer.getData('text/html');
  if (html && html.startsWith(HTML_DATA_BEGIN)) {
    const endIdx = html.indexOf(HTML_DATA_END);
    if (endIdx !== -1) {
      // Extract JSON between the begin marker and end marker.
      // Format: <!--tabsoutlinerdata:begin JSON_HERE tabsoutlinerdata:end-->
      const jsonStart = HTML_DATA_BEGIN.length;
      const jsonStr = html.substring(jsonStart, endIdx).trim();
      if (jsonStr) return jsonStr;
    }
  }

  return null;
}

export function EmptyTreeImport({ onImport, importResult }: EmptyTreeImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileRead = useCallback(
    (file: File) => {
      setIsReading(true);
      const reader = new FileReader();
      reader.onload = () => {
        setIsReading(false);
        if (typeof reader.result === 'string') {
          onImport(reader.result);
        }
      };
      reader.onerror = () => {
        setIsReading(false);
      };
      reader.readAsText(file);
    },
    [onImport],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.currentTarget.files?.[0];
      if (file) handleFileRead(file);
    },
    [handleFileRead],
  );

  const handleDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const dt = e.dataTransfer;
      if (!dt) return;

      // Try extracting tree data from DnD payload (legacy extension)
      const treeJson = extractTreeFromDrag(dt as unknown as DataTransfer);
      if (treeJson) {
        onImport(treeJson);
        return;
      }

      // Fall back to dropped files (.tree / .json)
      const file = dt.files?.[0];
      if (file) {
        handleFileRead(file);
      }
    },
    [onImport, handleFileRead],
  );

  const dropZoneClass = [
    'import-drop-zone',
    isDragOver ? 'drag-over' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="empty-tree-import">
      <h2>Welcome to Tabs Outliner Revival</h2>
      <p>No saved tree data was found.</p>

      <div
        className={dropZoneClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="drop-zone-text">
          Drag your tree here from Tabs Outliner
        </p>
        <p className="drop-zone-subtext">
          or drop a <code>.tree</code> backup file
        </p>
      </div>

      <div className="import-divider">or</div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".tree,.json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        className="import-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={isReading}
      >
        {isReading ? 'Reading file...' : 'Choose .tree File'}
      </button>

      {importResult && !importResult.success && (
        <div className="import-error">
          Import failed: {importResult.error ?? 'Unknown error'}
        </div>
      )}
      {importResult?.success && (
        <div className="import-success">
          Imported {importResult.nodeCount} nodes successfully.
        </div>
      )}
    </div>
  );
}
