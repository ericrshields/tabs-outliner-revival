import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { EmptyTreeImport } from './EmptyTreeImport';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('EmptyTreeImport', () => {
  it('renders welcome message and import button', () => {
    const { container } = render(
      <EmptyTreeImport onImport={vi.fn()} importResult={null} />,
    );

    expect(container.textContent).toContain('Welcome to Tabs Outliner Revival');
    expect(container.querySelector('.import-btn')).toBeTruthy();
    expect(container.querySelector('.import-drop-zone')).toBeTruthy();
  });

  it('renders drop zone with drag instruction', () => {
    const { container } = render(
      <EmptyTreeImport onImport={vi.fn()} importResult={null} />,
    );

    expect(container.textContent).toContain('Drag your tree here');
    expect(container.textContent).toContain('.tree');
  });

  it('calls onImport with DnD data from application/x-tabsoutliner-items', () => {
    const onImport = vi.fn();
    const { container } = render(
      <EmptyTreeImport onImport={onImport} importResult={null} />,
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
      <EmptyTreeImport onImport={onImport} importResult={null} />,
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
      <EmptyTreeImport
        onImport={vi.fn()}
        importResult={{ success: false, nodeCount: 0, error: 'Bad format' }}
      />,
    );

    expect(container.querySelector('.import-error')!.textContent).toContain(
      'Bad format',
    );
  });

  it('shows success message when import succeeds', () => {
    const { container } = render(
      <EmptyTreeImport
        onImport={vi.fn()}
        importResult={{ success: true, nodeCount: 42 }}
      />,
    );

    expect(container.querySelector('.import-success')!.textContent).toContain(
      '42 nodes',
    );
  });

  it('adds drag-over class during dragover', () => {
    const { container } = render(
      <EmptyTreeImport onImport={vi.fn()} importResult={null} />,
    );

    const dropZone = container.querySelector('.import-drop-zone')!;
    fireEvent.dragOver(dropZone);
    expect(dropZone.classList.contains('drag-over')).toBe(true);
  });

  it('removes drag-over class on dragleave', () => {
    const { container } = render(
      <EmptyTreeImport onImport={vi.fn()} importResult={null} />,
    );

    const dropZone = container.querySelector('.import-drop-zone')!;
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);
    expect(dropZone.classList.contains('drag-over')).toBe(false);
  });
});
