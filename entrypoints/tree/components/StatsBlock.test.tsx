import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { StatsBlockView } from './StatsBlock';
import type { StatsBlock } from '@/types/node-dto';

function makeStats(
  overrides: Partial<StatsBlock> = {},
): StatsBlock {
  return {
    nodesCount: 0,
    activeWinsCount: 0,
    activeTabsCount: 0,
    ...overrides,
  };
}

describe('StatsBlockView', () => {
  it('returns null when all counts are zero', () => {
    const { container } = render(
      <StatsBlockView data={makeStats()} />,
    );
    expect(container.querySelector('.stats-block')).toBeNull();
  });

  it('shows tab count when activeTabsCount > 0', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ activeTabsCount: 5 })} />,
    );
    const block = container.querySelector('.stats-block');
    expect(block).toBeTruthy();
    expect(container.querySelector('.stats-tabs-count')!.textContent).toBe('5');
  });

  it('shows tab count icon', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ activeTabsCount: 3 })} />,
    );
    expect(container.querySelector('.stats-tabs-icon')).toBeTruthy();
  });

  it('shows window count when activeWinsCount > 0', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ activeWinsCount: 2 })} />,
    );
    expect(container.querySelector('.stats-wins-count')!.textContent).toBe('2');
  });

  it('shows window count icon', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ activeWinsCount: 1 })} />,
    );
    expect(container.querySelector('.stats-wins-icon')).toBeTruthy();
  });

  it('shows node count when different from activeTabsCount', () => {
    const { container } = render(
      <StatsBlockView
        data={makeStats({ activeTabsCount: 3, nodesCount: 5 })}
      />,
    );
    expect(container.querySelector('.stats-nodes-count')!.textContent).toBe('5');
  });

  it('hides node count when equal to activeTabsCount', () => {
    const { container } = render(
      <StatsBlockView
        data={makeStats({ activeTabsCount: 3, nodesCount: 3 })}
      />,
    );
    expect(container.querySelector('.stats-nodes-count')).toBeNull();
  });
});
