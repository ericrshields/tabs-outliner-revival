import { browser } from 'wxt/browser';
import type { ViewToBackgroundMessage } from '@/types/messages';
import {
  createWindow,
  createGroup,
  createSeparator,
  exportTree,
  exportTreeHtml,
} from '@/view/tree-actions';

interface MainToolbarProps {
  /** Ref to the last deliberately-interacted node idMVC (same ref used by keyboard shortcuts). */
  cursorIdRef: { current: string | null };
  postMessage: (msg: ViewToBackgroundMessage) => void;
}

function openSettings() {
  window.open(
    browser.runtime.getURL('/options.html'),
    '_blank',
    'popup,width=540,height=680',
  );
}

export function MainToolbar({ cursorIdRef, postMessage }: MainToolbarProps) {
  return (
    <div className="main-toolbar" role="toolbar" aria-label="Tree actions">
      <div className="main-toolbar-left">
        <button
          type="button"
          title="New Window"
          onClick={() => postMessage(createWindow(cursorIdRef.current))}
        >
          + Window
        </button>
        <button
          type="button"
          title="New Group"
          onClick={() => postMessage(createGroup(cursorIdRef.current))}
        >
          + Group
        </button>
        <button
          type="button"
          title="New Separator"
          onClick={() => postMessage(createSeparator(cursorIdRef.current))}
        >
          + Separator
        </button>

        <span className="main-toolbar-divider" />

        <button
          type="button"
          title="Export tree as .tree file"
          onClick={() => postMessage(exportTree())}
        >
          Export .tree
        </button>
        <button
          type="button"
          title="Export tree as HTML outline"
          onClick={() => postMessage(exportTreeHtml())}
        >
          Export .html
        </button>
      </div>
      <div className="main-toolbar-right">
        <button type="button" title="Settings" onClick={openSettings}>
          Settings
        </button>
      </div>
    </div>
  );
}
