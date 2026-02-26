import { useRef, useState, useCallback } from 'react';
import type { DragEvent as ReactDragEvent, ChangeEvent, MouseEvent } from 'react';
import type { ImportResultState } from '@/view/hooks/use-tree-data';
import { extractTreeFromDrag } from './drag-import';

export interface FirstRunImportProps {
  onImport: (json: string) => void;
  onDismiss: () => void;
  importResult: ImportResultState | null;
}

export function FirstRunImport({ onImport, onDismiss, importResult }: FirstRunImportProps) {
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
      console.log('[FirstRunImport] handleDrop fired');

      const dt = e.dataTransfer;
      if (!dt) {
        console.log('[FirstRunImport] dataTransfer is null');
        return;
      }

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

  // Prevent overlay backdrop from dismissing on drag-and-drop release
  const handleOverlayClick = useCallback(
    (e: MouseEvent) => {
      // Only dismiss on genuine clicks, not mouse-up from DnD
      if (e.detail > 0) onDismiss();
    },
    [onDismiss],
  );

  return (
    <div
      className="first-run-overlay"
      onClick={handleOverlayClick}
      onDragOver={(e: ReactDragEvent<HTMLDivElement>) => e.preventDefault()}
      onDrop={(e: ReactDragEvent<HTMLDivElement>) => {
        // Prevent drops on the backdrop from bubbling to browser default
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="first-run-import" onClick={(e) => e.stopPropagation()}>
        <h2>Welcome to Tabs Outliner Revival</h2>
        <p>
          Import your tree from the original Tabs Outliner by dragging it
          here, or choose a <code>.tree</code> backup file.
        </p>

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

        <button className="dismiss-btn" onClick={onDismiss}>
          Skip — start fresh
        </button>
      </div>
    </div>
  );
}
