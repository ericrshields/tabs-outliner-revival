/**
 * BadgeManager — browser action badge and tooltip updates.
 *
 * Reads tree stats and formats them for display on the extension
 * icon badge. Shows total node count on the badge and a more
 * detailed breakdown in the tooltip.
 */

import { setBadgeText, setBadgeColor, setTooltip } from '@/chrome/action';
import type { TreeModel } from '@/tree/tree-model';

const BADGE_COLOR = '#4688F1';

/** Update badge text and tooltip with current tree stats. */
export async function updateBadge(model: TreeModel): Promise<void> {
  const stats = model.root.countSubnodesStats();

  const badgeText = stats.nodesCount > 0 ? String(stats.nodesCount) : '';

  const tooltipParts = ['Tabs Outliner Revival'];
  if (stats.nodesCount > 0) {
    tooltipParts.push(
      `${stats.nodesCount} nodes, ${stats.activeWinsCount} windows, ${stats.activeTabsCount} tabs`,
    );
  }

  await Promise.all([
    setBadgeText(badgeText),
    setBadgeColor(BADGE_COLOR),
    setTooltip(tooltipParts.join('\n')),
  ]);
}
