import type { StatsBlock } from '@/types/node-dto';

export function StatsBlockView({ data }: { data: StatsBlock }) {
  const parts: { key: string; className: string; iconClass?: string; value: number }[] = [];

  if (data.activeTabsCount > 0) {
    parts.push({
      key: 'tabs',
      className: 'stats-tabs-count',
      iconClass: 'stats-counter-icon stats-tabs-icon',
      value: data.activeTabsCount,
    });
  }

  if (data.activeWinsCount > 0) {
    parts.push({
      key: 'wins',
      className: 'stats-wins-count',
      iconClass: 'stats-counter-icon stats-wins-icon',
      value: data.activeWinsCount,
    });
  }

  if (data.nodesCount > 0 && data.nodesCount !== data.activeTabsCount) {
    parts.push({
      key: 'nodes',
      className: 'stats-nodes-count',
      value: data.nodesCount,
    });
  }

  if (parts.length === 0) return null;

  return (
    <span className="stats-block">
      {parts.map((p) => (
        <span key={p.key} className={p.className}>
          {p.iconClass && <span className={p.iconClass} />}
          {p.value}
        </span>
      ))}
    </span>
  );
}
