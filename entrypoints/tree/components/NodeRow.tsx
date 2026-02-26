import { useContext } from 'react';
import type { NodeRendererProps } from 'react-arborist';
import type { NodeDTO } from '@/types/node-dto';
import { TreeContext } from './TreeContext';
import { WindowFrame } from './WindowFrame';
import { StatsBlockView } from './StatsBlock';

const COLOR_RE = /color:\s*(#[0-9a-fA-F]{3,8}|[a-z]+)/;

function parseCustomStyle(raw: string | null): { color: string } | undefined {
  if (!raw) return undefined;
  const match = COLOR_RE.exec(raw);
  return match ? { color: match[1] } : undefined;
}

export function NodeRow({
  node,
  style,
  dragHandle,
}: NodeRendererProps<NodeDTO>) {
  const data = node.data;
  const ctx = useContext(TreeContext);

  const isCursor = ctx.cursorId === data.idMVC;
  const isWindowFrame = data.titleBackgroundCssClass === 'windowFrame';

  const classNames = [
    'tree-node',
    node.isSelected ? 'selected' : '',
    data.titleBackgroundCssClass,
    data.isSelectedTab ? 'is-selected-tab' : '',
    data.isFocusedWindow ? 'is-focused-window' : '',
    isCursor ? 'cursor-node' : '',
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

  const textEl = (
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
