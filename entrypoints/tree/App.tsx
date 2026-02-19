import { useState, useCallback } from 'react';
import { Tree, NodeRendererProps, NodeApi } from 'react-arborist';

/**
 * Prototype: Validates react-arborist works with Preact via compat layer.
 * Tests: rendering, expand/collapse, custom renderer, keyboard nav, DnD, CRUD.
 */

interface TabNode {
  id: string;
  name: string;
  type: 'window' | 'tab' | 'group' | 'separator';
  url?: string;
  children?: TabNode[];
}

const initialData: TabNode[] = [
  {
    id: 'win-1',
    name: 'Main Window',
    type: 'window',
    children: [
      {
        id: 'tab-1',
        name: 'GitHub - tabs-outliner-revival',
        type: 'tab',
        url: 'https://github.com/example/tabs-outliner-revival',
      },
      {
        id: 'tab-2',
        name: 'Stack Overflow - Preact compat',
        type: 'tab',
        url: 'https://stackoverflow.com/questions/preact-compat',
      },
      {
        id: 'group-1',
        name: 'Research',
        type: 'group',
        children: [
          {
            id: 'tab-3',
            name: 'WXT Documentation',
            type: 'tab',
            url: 'https://wxt.dev',
          },
          {
            id: 'tab-4',
            name: 'react-arborist API',
            type: 'tab',
            url: 'https://github.com/brimdata/react-arborist',
          },
        ],
      },
    ],
  },
  {
    id: 'win-2',
    name: 'Saved Window (closed)',
    type: 'window',
    children: [
      {
        id: 'tab-5',
        name: 'MDN - Chrome Extensions',
        type: 'tab',
        url: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions',
      },
      { id: 'sep-1', name: '───────────', type: 'separator' },
      {
        id: 'tab-6',
        name: 'Chrome Extension Docs',
        type: 'tab',
        url: 'https://developer.chrome.com/docs/extensions',
      },
    ],
  },
];

const TYPE_ICONS: Record<TabNode['type'], string> = {
  window: '\u{1F5D4}',
  tab: '\u{1F4C4}',
  group: '\u{1F4C1}',
  separator: '\u2500',
};

function Node({ node, style, dragHandle }: NodeRendererProps<TabNode>) {
  const data = node.data;
  const isSelected = node.isSelected;

  return (
    <div
      ref={dragHandle}
      style={style}
      onClick={() => node.isInternal && node.toggle()}
      className={`tree-node ${isSelected ? 'selected' : ''} type-${data.type}`}
    >
      <span className="node-arrow">
        {node.isInternal ? (node.isOpen ? '\u25BC' : '\u25B6') : ' '}
      </span>
      <span className="node-icon">{TYPE_ICONS[data.type]}</span>
      <span className="node-name">{data.name}</span>
      {data.url && <span className="node-url">{data.url}</span>}
    </div>
  );
}

export function App() {
  const [data, _setData] = useState(initialData);
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), msg]);
  }, []);

  const onMove = useCallback(
    ({
      dragIds,
      parentId,
      index,
    }: {
      dragIds: string[];
      parentId: string | null;
      index: number;
    }) => {
      addLog(
        `Move: ${dragIds.join(', ')} → parent=${parentId ?? 'root'} index=${index}`,
      );
    },
    [addLog],
  );

  const onSelect = useCallback(
    (nodes: NodeApi<TabNode>[]) => {
      if (nodes.length > 0) {
        addLog(`Select: ${nodes.map((n) => n.data.name).join(', ')}`);
      }
    },
    [addLog],
  );

  const onToggle = useCallback(
    (id: string) => {
      addLog(`Toggle: ${id}`);
    },
    [addLog],
  );

  return (
    <div className="prototype-container">
      <header>
        <h1>Tabs Outliner Revival — react-arborist Prototype</h1>
        <p>
          Testing: render, expand/collapse, custom renderer, keyboard nav, DnD
        </p>
      </header>

      <div className="prototype-layout">
        <div className="tree-container">
          <Tree<TabNode>
            data={data}
            width={600}
            height={400}
            rowHeight={28}
            indent={24}
            onMove={onMove}
            onSelect={onSelect}
            onToggle={onToggle}
          >
            {Node}
          </Tree>
        </div>

        <div className="event-log">
          <h3>Event Log</h3>
          <div className="log-entries">
            {log.length === 0 ? (
              <p className="log-hint">
                Click nodes, use arrow keys, drag items...
              </p>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="log-entry">
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
