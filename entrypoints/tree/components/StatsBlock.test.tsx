import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { StatsBlockView } from './StatsBlock';
import type { StatsBlock } from '@/types/node-dto';

function makeStats(overrides: Partial<StatsBlock> = {}): StatsBlock {
  return {
    nodesCount: 0,
    activeTabsCount: 0,
    savedTabsCount: 0,
    activeWinsCount: 0,
    savedWinsCount: 0,
    activeGroupsCount: 0,
    savedGroupsCount: 0,
    notesCount: 0,
    separatorsCount: 0,
    sessionsCount: 0,
    ...overrides,
  };
}

describe('StatsBlockView', () => {
  it('returns null when every counter is zero', () => {
    const { container } = render(<StatsBlockView data={makeStats()} />);
    expect(container.querySelector('.stats-block')).toBeNull();
  });

  it('renders total tabs (active + saved) under stats-tabs-total', () => {
    const { container } = render(
      <StatsBlockView
        data={makeStats({ activeTabsCount: 3, savedTabsCount: 4 })}
      />,
    );
    expect(container.querySelector('.stats-tabs-total')!.textContent).toBe('7');
  });

  it('renders active containers (windows alone) under stats-active-containers', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ activeWinsCount: 2 })} />,
    );
    expect(
      container.querySelector('.stats-active-containers')!.textContent,
    ).toBe('2');
  });

  it('combines windows and active groups in active containers count', () => {
    const { container } = render(
      <StatsBlockView
        data={makeStats({ activeWinsCount: 1, activeGroupsCount: 3 })}
      />,
    );
    expect(
      container.querySelector('.stats-active-containers')!.textContent,
    ).toBe('4');
  });

  it('renders active groups alone as active containers (no Chrome windows present)', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ activeGroupsCount: 2 })} />,
    );
    expect(
      container.querySelector('.stats-active-containers')!.textContent,
    ).toBe('2');
  });

  it('does not count saved (empty) groups as active containers', () => {
    const { container } = render(
      <StatsBlockView
        data={makeStats({ savedGroupsCount: 4, savedTabsCount: 5 })}
      />,
    );
    // Saved groups should not contribute to the active-containers slot.
    expect(container.querySelector('.stats-active-containers')).toBeNull();
    // Total tabs still surfaces saved tabs.
    expect(container.querySelector('.stats-tabs-total')!.textContent).toBe('5');
  });

  it('renders active tabs under stats-active-tabs', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ activeTabsCount: 5 })} />,
    );
    expect(container.querySelector('.stats-active-tabs')!.textContent).toBe(
      '5',
    );
  });

  it('renders all three counters together with the active-window block', () => {
    const { container } = render(
      <StatsBlockView
        data={makeStats({
          activeTabsCount: 5,
          activeWinsCount: 1,
          nodesCount: 6,
        })}
      />,
    );
    expect(container.querySelector('.stats-tabs-total')!.textContent).toBe('5');
    expect(
      container.querySelector('.stats-active-containers')!.textContent,
    ).toBe('1');
    expect(container.querySelector('.stats-active-tabs')!.textContent).toBe(
      '5',
    );
  });

  it('omits zero counters', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ activeTabsCount: 3 })} />,
    );
    expect(container.querySelector('.stats-tabs-total')!.textContent).toBe('3');
    expect(container.querySelector('.stats-active-containers')).toBeNull();
    // activeTabsCount is non-zero so the stats-active-tabs counter still shows
    expect(container.querySelector('.stats-active-tabs')!.textContent).toBe(
      '3',
    );
  });

  it('falls back to nodesCount when no tabs/windows exist (e.g. notes-only group)', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ notesCount: 4, nodesCount: 4 })} />,
    );
    expect(container.querySelector('.stats-nodes-fallback')!.textContent).toBe(
      '4',
    );
    expect(container.querySelector('.stats-tabs-total')).toBeNull();
  });

  it('counts saved tabs in the total even when no active tabs are present', () => {
    const { container } = render(
      <StatsBlockView data={makeStats({ savedTabsCount: 6 })} />,
    );
    expect(container.querySelector('.stats-tabs-total')!.textContent).toBe('6');
    expect(container.querySelector('.stats-active-tabs')).toBeNull();
  });
});
