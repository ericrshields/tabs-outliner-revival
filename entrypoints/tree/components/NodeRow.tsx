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
    data._isSelectedTab ? 'is-selected-tab' : '',
    data._isFocusedWindow ? 'is-focused-window' : '',
    isCursor ? 'cursor-node' : '',
    data._getNodeContentCssClass ? `ncc-${data._getNodeContentCssClass}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleMouseEnter = (e: { currentTarget: EventTarget | null }) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    ctx.onRowEnter(
      data.idMVC,
      { idMVC: data.idMVC, actions: data._hoveringMenuActions },
      rect,
    );
  };

  const textStyle = parseCustomStyle(data._getNodeTextCustomStyle);

  const arrow = node.isInternal ? (node.isOpen ? '\u25BC' : '\u25B6') : ' ';

  const textContent = data._getHref ? (
    <a
      href={data._getHref}
      draggable={false}
      onClick={(e) => {
        // Allow ctrl+click / middle-click to follow link naturally
        if (!e.ctrlKey && !e.metaKey && e.button === 0) {
          e.preventDefault();
        }
      }}
    >
      {data._getNodeText}
    </a>
  ) : (
    data._getNodeText
  );

  const icon = data._getIcon ? (
    <img className="node-icon" src={data._getIcon} alt="" />
  ) : null;

  const textEl = (
    <span
      className={`node-text ${data.titleCssClass}`}
      style={textStyle}
      title={data._getTooltipText || undefined}
    >
      {textContent}
    </span>
  );

  const statsBlock =
    data._countSubnodesStatsBlockData && !node.isOpen ? (
      <StatsBlockView data={data._countSubnodesStatsBlockData} />
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
