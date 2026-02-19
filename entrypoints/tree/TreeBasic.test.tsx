import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { Tree } from 'react-arborist';

const data = [
  { id: '1', name: 'Node 1' },
  { id: '2', name: 'Node 2', children: [{ id: '3', name: 'Child 1' }] },
];

describe('react-arborist + Preact compat', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <Tree data={data} width={300} height={200} />,
    );
    // react-arborist mounts and renders its container.
    // Content is empty because react-window virtualization needs real DOM dimensions.
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
