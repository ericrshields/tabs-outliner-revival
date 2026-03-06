import type { ViewToBackgroundMessage } from '@/types/messages';
import { exportTree, exportTreeHtml } from '@/view/tree-actions';

interface ExportToolbarProps {
  postMessage: (msg: ViewToBackgroundMessage) => void;
}

export function ExportToolbar({ postMessage }: ExportToolbarProps) {
  return (
    <div className="export-toolbar" role="group" aria-label="Export options">
      <button
        type="button"
        className="import-btn"
        onClick={() => postMessage(exportTree())}
      >
        Export .tree
      </button>
      <button
        type="button"
        className="import-btn"
        onClick={() => postMessage(exportTreeHtml())}
      >
        Export .html
      </button>
    </div>
  );
}
