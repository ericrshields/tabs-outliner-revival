import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { App } from './App';

describe('Tree App prototype', () => {
  it('renders the heading', () => {
    render(<App />);
    expect(
      screen.getByText('Tabs Outliner Revival — react-arborist Prototype'),
    ).toBeTruthy();
  });
});
