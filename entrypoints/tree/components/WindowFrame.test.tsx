import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { WindowFrame } from './WindowFrame';

describe('WindowFrame', () => {
  it('renders children inside a span with window-frame-box class', () => {
    const { container } = render(
      <WindowFrame type="win">
        <span>Window Title</span>
      </WindowFrame>,
    );
    const box = container.querySelector('.window-frame-box');
    expect(box).toBeTruthy();
    expect(box!.textContent).toBe('Window Title');
  });

  it('applies the type as a CSS class', () => {
    const { container } = render(
      <WindowFrame type="savedwin">
        <span>Saved</span>
      </WindowFrame>,
    );
    const box = container.querySelector('.window-frame-box.savedwin');
    expect(box).toBeTruthy();
  });

  it('applies group type class', () => {
    const { container } = render(
      <WindowFrame type="group">
        <span>Group</span>
      </WindowFrame>,
    );
    expect(container.querySelector('.window-frame-box.group')).toBeTruthy();
  });

  it('applies session type class', () => {
    const { container } = render(
      <WindowFrame type="session">
        <span>Session</span>
      </WindowFrame>,
    );
    expect(container.querySelector('.window-frame-box.session')).toBeTruthy();
  });
});
