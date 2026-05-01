import type { StatsBlock } from '@/types/node-dto';

/**
 * Stats block rendered next to a collapsed node.
 *
 * Shows three counters in a fixed order, dropping any that are zero:
 *   1. Total tabs (active + saved)              — greyscale globe
 *   2. Active containers (windows + groups)     — greyscale chrome icon
 *   3. Active tabs currently in Chrome          — colored globe
 *
 * "Active containers" combines live Chrome windows and groups that
 * have at least one active tab or window descendant. Chrome
 * materializes a window for any such group, so from the user's
 * perspective they're identical to active windows. An empty group, or
 * a group containing only saved content, is not an active container.
 *
 * If none of the three is non-zero (e.g. a collapsed group of only
 * notes or separators), fall back to a bare `nodesCount` so the user
 * still sees that the collapsed node is non-empty.
 *
 * The full per-bucket breakdown is always available on the underlying
 * `StatsBlock` data (saved tabs/windows, saved/active groups, notes,
 * separators, sessions); only a curated subset is currently rendered.
 */
export function StatsBlockView({ data }: { data: StatsBlock }) {
  const totalTabsCount = data.activeTabsCount + data.savedTabsCount;
  const activeContainersCount = data.activeWinsCount + data.activeGroupsCount;

  const parts: { key: string; className: string; value: number }[] = [];

  if (totalTabsCount > 0) {
    parts.push({
      key: 'tabs-total',
      className: 'stats-counter stats-tabs-total',
      value: totalTabsCount,
    });
  }
  if (activeContainersCount > 0) {
    parts.push({
      key: 'active-containers',
      className: 'stats-counter stats-active-containers',
      value: activeContainersCount,
    });
  }
  if (data.activeTabsCount > 0) {
    parts.push({
      key: 'active-tabs',
      className: 'stats-counter stats-active-tabs',
      value: data.activeTabsCount,
    });
  }

  if (parts.length === 0) {
    if (data.nodesCount <= 0) return null;
    return (
      <span className="stats-block">
        <span className="stats-counter stats-nodes-fallback">
          {data.nodesCount}
        </span>
      </span>
    );
  }

  return (
    <span className="stats-block">
      {parts.map((p) => (
        <span key={p.key} className={p.className}>
          <span className="stats-icon" />
          {p.value}
        </span>
      ))}
    </span>
  );
}
