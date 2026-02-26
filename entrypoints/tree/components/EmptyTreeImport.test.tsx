import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { FirstRunImport } from './EmptyTreeImport';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('FirstRunImport', () => {
  it('renders welcome message, import button, and dismiss button', () => {
    const { container } = render(
      <FirstRunImport onImport={vi.fn()} onDismiss={vi.fn()} importResult={null} />,
    );

    expect(container.textContent).toContain('Welcome to Tabs Outliner Revival');
    expect(container.querySelector('.import-btn')).toBeTruthy();
    expect(container.querySelector('.import-drop-zone')).toBeTruthy();
    expect(container.querySelector('.dismiss-btn')).toBeTruthy();
  });

  it('renders as an overlay', () => {
    const { container } = render(
      <FirstRunImport onImport={vi.fn()} onDismiss={vi.fn()} importResult={null} />,
    );

    expect(container.querySelector('.first-run-overlay')).toBeTruthy();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <FirstRunImport onImport={vi.fn()} onDismiss={onDismiss} importResult={null} />,
    );

    fireEvent.click(container.querySelector('.dismiss-btn')!);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when overlay backdrop clicked', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <FirstRunImport onImport={vi.fn()} onDismiss={onDismiss} importResult={null} />,
    );

    fireEvent.click(container.querySelector('.first-run-overlay')!);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not dismiss when modal content clicked', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <FirstRunImport onImport={vi.fn()} onDismiss={onDismiss} importResult={null} />,
    );

    fireEvent.click(container.querySelector('.first-run-import')!);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('calls onImport with DnD data from application/x-tabsoutliner-items', () => {
    const onImport = vi.fn();
    const { container } = render(
      <FirstRunImport onImport={onImport} onDismiss={vi.fn()} importResult={null} />,
    );

    const dropZone = container.querySelector('.import-drop-zone')!;
    const treeJson = JSON.stringify({ n: { data: {} }, s: [] });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        getData: (type: string) =>
          type === 'application/x-tabsoutliner-items' ? treeJson : '',
        files: [],
      },
    });

    expect(onImport).toHaveBeenCalledWith(treeJson);
  });

  it('calls onImport with embedded JSON from text/html fallback', () => {
    const onImport = vi.fn();
    const { container } = render(
      <FirstRunImport onImport={onImport} onDismiss={vi.fn()} importResult={null} />,
    );

    const dropZone = container.querySelector('.import-drop-zone')!;
    const embeddedJson = '{"n":{"data":{}},"s":[]}';
    const html = `<!--tabsoutlinerdata:begin ${embeddedJson} tabsoutlinerdata:end-->`;

    fireEvent.drop(dropZone, {
      dataTransfer: {
        getData: (type: string) => (type === 'text/html' ? html : ''),
        files: [],
      },
    });

    expect(onImport).toHaveBeenCalledWith(embeddedJson);
  });

  it('shows error message when import fails', () => {
    const { container } = render(
      <FirstRunImport
        onImport={vi.fn()}
        onDismiss={vi.fn()}
        importResult={{ success: false, nodeCount: 0, error: 'Bad format' }}
      />,
    );

    expect(container.querySelector('.import-error')!.textContent).toContain(
      'Bad format',
    );
  });

  it('shows success message when import succeeds', () => {
    const { container } = render(
      <FirstRunImport
        onImport={vi.fn()}
        onDismiss={vi.fn()}
        importResult={{ success: true, nodeCount: 42 }}
      />,
    );

    expect(container.querySelector('.import-success')!.textContent).toContain(
      '42 nodes',
    );
  });

  it('adds drag-over class during dragover', () => {
    const { container } = render(
      <FirstRunImport onImport={vi.fn()} onDismiss={vi.fn()} importResult={null} />,
    );

    const dropZone = container.querySelector('.import-drop-zone')!;
    fireEvent.dragOver(dropZone);
    expect(dropZone.classList.contains('drag-over')).toBe(true);
  });
});
