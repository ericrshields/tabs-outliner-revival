import { useContext, useRef, useEffect } from 'react';
import type { NodeRendererProps } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import type { EditKind } from '@/types/tree-context';
import { TreeContext } from './TreeContext';
import { WindowFrame } from './WindowFrame';
import { StatsBlockView } from './StatsBlock';

const COLOR_RE = /color:\s*(#[0-9a-fA-F]{3,8}|[a-z]+)/;

function parseCustomStyle(raw: string | null): { color: string } | undefined {
  if (!raw) return undefined;
  const match = COLOR_RE.exec(raw);
  return match ? { color: match[1] } : undefined;
}

/** Derive the edit kind from the node's background CSS class. */
function editKindFromFrame(
  frame: NodeDTO['titleBackgroundCssClass'],
): EditKind {
  if (frame === 'tabFrame') return 'tab';
  if (frame === 'windowFrame') return 'window';
  return 'note';
}

export function NodeRow({
  node,
  style,
  dragHandle,
}: NodeRendererProps<NodeDTO>) {
  const data = node.data;
  const ctx = useContext(TreeContext);

  const isEditing = ctx.editingId === data.idMVC;
  const isCursor = ctx.cursorId === data.idMVC;
  const isHovered = ctx.hoveredId === data.idMVC;
  const isWindowFrame = data.titleBackgroundCssClass === 'windowFrame';

  // Prevents double-submit: Enter fires onKeyDown then triggers onBlur on unmount.
  const editCommittedRef = useRef(false);
  useEffect(() => {
    editCommittedRef.current = false;
  }, [ctx.editingId]);

  const classNames = [
    'tree-node',
    node.isSelected ? 'selected' : '',
    data.titleBackgroundCssClass,
    data.isSelectedTab ? 'is-selected-tab' : '',
    data.isFocusedWindow ? 'is-focused-window' : '',
    isCursor ? 'cursor-node' : '',
    isHovered ? 'hovered' : '',
    data.nodeContentCssClass ? `ncc-${data.nodeContentCssClass}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleMouseEnter = (e: { currentTarget: EventTarget | null }) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    ctx.onRowEnter(
      data.idMVC,
      { idMVC: data.idMVC, actions: data.hoveringMenuActions },
      rect,
    );
  };

  const textStyle = parseCustomStyle(data.nodeTextCustomStyle);

  const arrow = node.isInternal ? (node.isOpen ? '\u25BC' : '\u25B6') : ' ';

  const textContent = data.href ? (
    <a
      href={data.href}
      draggable={false}
      onClick={(e) => {
        // Allow ctrl+click / middle-click to follow link naturally
        if (!e.ctrlKey && !e.metaKey && e.button === 0) {
          e.preventDefault();
        }
      }}
    >
      {data.nodeText}
    </a>
  ) : (
    data.nodeText
  );

  const icon = data.icon ? (
    <img className="node-icon" src={data.icon} alt="" />
  ) : null;

  const kind = editKindFromFrame(data.titleBackgroundCssClass);

  const textEl = isEditing ? (
    <input
      className="node-edit-input"
      defaultValue={ctx.editDefaultText}
      placeholder="Enter title…"
      autoFocus
      ref={(el) => {
        if (!el) return;
        // autoFocus fires before defaultValue is applied to the DOM.
        // Using a ref callback guarantees the value is set before we
        // position the cursor.
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          editCommittedRef.current = true;
          ctx.onEditComplete(data.idMVC, e.currentTarget.value, kind);
        } else if (e.key === 'Escape') {
          editCommittedRef.current = true;
          ctx.onEditCancel();
        }
        // Prevent keyboard shortcuts from firing while the input is active.
        e.stopPropagation();
      }}
      onBlur={() => {
        // Blur (click outside / focus loss) cancels without saving.
        // Commit only happens on Enter.
        if (!editCommittedRef.current) {
          ctx.onEditCancel();
        }
      }}
    />
  ) : (
    <span
      className={`node-text ${data.titleCssClass}`}
      style={textStyle}
      title={data.tooltipText || undefined}
    >
      {textContent}
    </span>
  );

  const statsBlock =
    data.statsBlockData && !node.isOpen ? (
      <StatsBlockView data={data.statsBlockData} />
    ) : null;

  const innerContent = isWindowFrame ? (
    <>
      <WindowFrame type={data.titleCssClass}>
        {icon}
        {textEl}
      </WindowFrame>
      {statsBlock}
    </>
  ) : (
    <>
      {icon}
      {textEl}
      {statsBlock}
    </>
  );

  return (
    <div
      ref={dragHandle}
      style={style}
      className={classNames}
      onMouseEnter={handleMouseEnter}
      onContextMenu={(e) => {
        e.preventDefault();
        ctx.onContextMenu(data.idMVC, data, e.clientX, e.clientY);
      }}
    >
      <span
        className="node-arrow"
        onClick={(e) => {
          if (node.isInternal) {
            e.stopPropagation();
            node.toggle();
          }
        }}
      >
        {arrow}
      </span>
      {innerContent}
    </div>
  );
}
