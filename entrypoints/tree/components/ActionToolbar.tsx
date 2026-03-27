import type { ViewToBackgroundMessage } from '@/types/messages';
import {
  createWindow,
  createGroup,
  createSeparator,
} from '@/view/tree-actions';

interface ActionToolbarProps {
  /** Ref to the last deliberately-interacted node idMVC (same ref used by keyboard shortcuts). */
  cursorIdRef: { current: string | null };
  postMessage: (msg: ViewToBackgroundMessage) => void;
}

const SETTINGS_URL = new URL('/options.html', window.location.href).href;

function openSettings() {
  window.open(SETTINGS_URL, '_blank', 'popup,width=540,height=680');
}

export function ActionToolbar({
  cursorIdRef,
  postMessage,
}: ActionToolbarProps) {
  return (
    <div className="action-toolbar" role="toolbar" aria-label="Tree actions">
      <div className="action-toolbar-left">
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
      </div>
      <div className="action-toolbar-right">
        <button type="button" title="Settings" onClick={openSettings}>
          Settings
        </button>
      </div>
    </div>
  );
}
