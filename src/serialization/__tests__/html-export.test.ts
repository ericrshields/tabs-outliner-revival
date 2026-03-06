import { describe, it, expect, beforeAll } from 'vitest';
import { treeToHtml, encodeEntities } from '../html-export';
import { SessionTreeNode } from '@/tree/nodes/session-node';
import { SavedTabTreeNode } from '@/tree/nodes/saved-tab-node';
import { SavedWindowTreeNode } from '@/tree/nodes/saved-window-node';
import { TextNoteTreeNode } from '@/tree/nodes/text-note-node';
import { SeparatorTreeNode } from '@/tree/nodes/separator-node';
import { GroupTreeNode } from '@/tree/nodes/group-node';

// Import the parser for round-trip tests — reimport via the same path as App
// The parser is in the entrypoints directory but testable as a pure function.
// We import tokenizeFromHtml indirectly via parseHtmlTreeDrop by checking
// the resulting HierarchyJSO structure.

describe('encodeEntities', () => {
  it('encodes &, <, >, ", and \'', () => {
    expect(encodeEntities('A & B')).toBe('A &amp; B');
    expect(encodeEntities('<tag>')).toBe('&lt;tag&gt;');
    expect(encodeEntities('"quoted"')).toBe('&quot;quoted&quot;');
    expect(encodeEntities("it's")).toBe('it&#39;s');
  });

  it('encodes all special characters in one string', () => {
    expect(encodeEntities('a & b < c > d " e \' f')).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &#39; f',
    );
  });

  it('returns plain text unchanged', () => {
    expect(encodeEntities('Hello World')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(encodeEntities('')).toBe('');
  });
});

describe('treeToHtml', () => {
  describe('node types', () => {
    it('serializes session root', () => {
      const session = new SessionTreeNode();
      const html = treeToHtml(session);
      expect(html).toBe('<li>Current Session</li>');
    });

    it('serializes saved tab with URL', () => {
      const tab = new SavedTabTreeNode({
        url: 'https://example.com',
        title: 'Example',
      });
      const html = treeToHtml(tab);
      expect(html).toBe(
        '<li><a href="https://example.com">Example</a></li>',
      );
    });

    it('serializes saved tab with customTitle as data attribute', () => {
      const tab = new SavedTabTreeNode({
        url: 'https://example.com',
        title: 'Example',
      });
      tab.setMarks({ relicons: [], customTitle: 'My Bookmark' });
      const html = treeToHtml(tab);
      // customTitle goes in data-custom-title attr; anchor text is the page title
      expect(html).toBe(
        '<li><a href="https://example.com" data-custom-title="My Bookmark">Example</a></li>',
      );
    });

    it('serializes saved tab with special characters in URL and title', () => {
      const tab = new SavedTabTreeNode({
        url: 'https://example.com/search?q=a&b=c',
        title: 'Search <results> & "more"',
      });
      const html = treeToHtml(tab);
      expect(html).toBe(
        '<li><a href="https://example.com/search?q=a&amp;b=c">Search &lt;results&gt; &amp; &quot;more&quot;</a></li>',
      );
    });

    it('serializes saved window with custom title', () => {
      const win = new SavedWindowTreeNode();
      win.setMarks({ relicons: [], customTitle: 'My Window' });
      const html = treeToHtml(win);
      expect(html).toBe('<li>My Window</li>');
    });

    it('serializes saved window without custom title as "Window"', () => {
      const win = new SavedWindowTreeNode();
      const html = treeToHtml(win);
      expect(html).toBe('<li>Window</li>');
    });

    it('serializes saved window with close date without date suffix', () => {
      const win = new SavedWindowTreeNode({ closeDate: Date.now() });
      const html = treeToHtml(win);
      // Should NOT include date decoration from getNodeText()
      expect(html).toBe('<li>Window</li>');
    });

    it('serializes renamed session root as "Current Session"', () => {
      const session = new SessionTreeNode();
      session.setMarks({ relicons: [], customTitle: 'My Tree' });
      const html = treeToHtml(session);
      // Must emit "Current Session" for isSessionTitle() to match at import
      expect(html).toBe('<li>Current Session</li>');
    });

    it('serializes empty text note as empty li', () => {
      const note = new TextNoteTreeNode({ note: '' });
      const html = treeToHtml(note);
      expect(html).toBe('<li></li>');
    });

    it('serializes text note with content', () => {
      const note = new TextNoteTreeNode({ note: 'Remember this' });
      const html = treeToHtml(note);
      expect(html).toBe('<li>Remember this</li>');
    });

    it('serializes separator', () => {
      const sep = new SeparatorTreeNode({ separatorIndx: 0 });
      const html = treeToHtml(sep);
      // Separator text is long dashes
      expect(html).toContain('<li>');
      expect(html).toContain('---');
      expect(html).toContain('</li>');
    });

    it('serializes group with custom title', () => {
      const group = new GroupTreeNode();
      group.setMarks({ relicons: [], customTitle: 'My Group' });
      const html = treeToHtml(group);
      expect(html).toBe('<li>My Group</li>');
    });
  });

  describe('hierarchy', () => {
    it('wraps children in ul', () => {
      const session = new SessionTreeNode();
      const tab = new SavedTabTreeNode({
        url: 'https://example.com',
        title: 'Example',
      });
      session.insertSubnode(0, tab);

      const html = treeToHtml(session);
      expect(html).toBe(
        '<li>Current Session</li><ul><li><a href="https://example.com">Example</a></li></ul>',
      );
    });

    it('handles nested hierarchy (session > window > tabs)', () => {
      const session = new SessionTreeNode();
      const win = new SavedWindowTreeNode();
      win.setMarks({ relicons: [], customTitle: 'Work' });
      const tab1 = new SavedTabTreeNode({ url: 'https://a.com', title: 'A' });
      const tab2 = new SavedTabTreeNode({ url: 'https://b.com', title: 'B' });
      win.insertSubnode(0, tab1);
      win.insertSubnode(1, tab2);
      session.insertSubnode(0, win);

      const html = treeToHtml(session);
      expect(html).toBe(
        '<li>Current Session</li><ul>' +
          '<li>Work</li><ul>' +
          '<li><a href="https://a.com">A</a></li>' +
          '<li><a href="https://b.com">B</a></li>' +
          '</ul></ul>',
      );
    });

    it('handles multiple top-level children', () => {
      const session = new SessionTreeNode();
      const win1 = new SavedWindowTreeNode();
      win1.setMarks({ relicons: [], customTitle: 'W1' });
      const win2 = new SavedWindowTreeNode();
      win2.setMarks({ relicons: [], customTitle: 'W2' });
      session.insertSubnode(0, win1);
      session.insertSubnode(1, win2);

      const html = treeToHtml(session);
      expect(html).toBe(
        '<li>Current Session</li><ul>' +
          '<li>W1</li><li>W2</li>' +
          '</ul>',
      );
    });
  });
});

describe('round-trip: treeToHtml → parseHtmlTreeDrop', () => {
  // We test the round-trip by dynamically importing the parser.
  // The parser lives in the entrypoints directory but is a pure function.

  // Use a simulated parseHtmlTreeDrop since the actual function uses a regex-based
  // tokenizer that we can import directly.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let parseHtmlTreeDrop: (html: string) => import('@/types/serialized').HierarchyJSO | null;

  // We need to re-implement the parse since drag-import.ts is not easily importable
  // in test context. Instead, import the module.
  beforeAll(async () => {
    const mod = await import(
      '../../../entrypoints/tree/components/drag-import'
    );
    // parseHtmlTreeDrop is not exported — we test the full extractTreeFromDrag path
    // by creating a mock DataTransfer. Or better: we use tokenizeFromHtml if exported.
    // Since parseHtmlTreeDrop is not exported, we'll test via extractTreeFromDrag.
    parseHtmlTreeDrop = (html: string) => {
      const result = mod.extractTreeFromDrag({
        types: ['text/html'] as readonly string[],
        getData: (type: string) => (type === 'text/html' ? html : ''),
        files: [] as unknown as FileList,
      });
      if (!result) return null;
      return JSON.parse(result);
    };
  });

  it('round-trips session with tabs', () => {
    const session = new SessionTreeNode();
    const tab = new SavedTabTreeNode({ url: 'https://example.com', title: 'Example' });
    session.insertSubnode(0, tab);

    const html = treeToHtml(session);
    const parsed = parseHtmlTreeDrop(html);

    expect(parsed).not.toBeNull();
    // Session root
    expect(parsed!.n.type).toBe('session');
    // One child: the tab
    expect(parsed!.s).toHaveLength(1);
    const tabNode = parsed!.s![0].n;
    expect(tabNode.type).toBeUndefined(); // savedtab has no explicit type
    expect((tabNode.data as { url: string }).url).toBe('https://example.com');
    expect((tabNode.data as { title: string }).title).toBe('Example');
  });

  it('round-trips session > window > tabs', () => {
    const session = new SessionTreeNode();
    const win = new SavedWindowTreeNode();
    win.setMarks({ relicons: [], customTitle: 'Research' });
    const tab1 = new SavedTabTreeNode({ url: 'https://a.com', title: 'Page A' });
    const tab2 = new SavedTabTreeNode({ url: 'https://b.com', title: 'Page B' });
    win.insertSubnode(0, tab1);
    win.insertSubnode(1, tab2);
    session.insertSubnode(0, win);

    const html = treeToHtml(session);
    const parsed = parseHtmlTreeDrop(html);

    expect(parsed).not.toBeNull();
    expect(parsed!.n.type).toBe('session');
    expect(parsed!.s).toHaveLength(1);

    const winNode = parsed!.s![0];
    expect(winNode.n.type).toBe('savedwin');
    expect(winNode.n.marks?.customTitle).toBe('Research');
    expect(winNode.s).toHaveLength(2);

    expect((winNode.s![0].n.data as { url: string }).url).toBe('https://a.com');
    expect((winNode.s![1].n.data as { url: string }).url).toBe('https://b.com');
  });

  it('round-trips tab customTitle via data-custom-title attribute', () => {
    const session = new SessionTreeNode();
    const tab = new SavedTabTreeNode({ url: 'https://example.com', title: 'Example Page' });
    tab.setMarks({ relicons: [], customTitle: 'My Bookmark' });
    session.insertSubnode(0, tab);

    const html = treeToHtml(session);
    const parsed = parseHtmlTreeDrop(html);

    expect(parsed).not.toBeNull();
    const tabNode = parsed!.s![0].n;
    // Page title preserved as data.title
    expect((tabNode.data as { title: string }).title).toBe('Example Page');
    // Custom title preserved as marks.customTitle
    expect(tabNode.marks?.customTitle).toBe('My Bookmark');
  });

  it('round-trips special characters in URLs and titles', () => {
    const session = new SessionTreeNode();
    const tab = new SavedTabTreeNode({
      url: 'https://example.com/search?q=a&b=c',
      title: 'Results for "a & b"',
    });
    session.insertSubnode(0, tab);

    const html = treeToHtml(session);
    const parsed = parseHtmlTreeDrop(html);

    expect(parsed).not.toBeNull();
    const tabNode = parsed!.s![0].n;
    expect((tabNode.data as { url: string }).url).toBe('https://example.com/search?q=a&b=c');
    expect((tabNode.data as { title: string }).title).toBe('Results for "a & b"');
  });

  it('round-trips empty text note', () => {
    const session = new SessionTreeNode();
    const note = new TextNoteTreeNode({ note: '' });
    session.insertSubnode(0, note);

    const html = treeToHtml(session);
    const parsed = parseHtmlTreeDrop(html);

    expect(parsed).not.toBeNull();
    const noteNode = parsed!.s![0].n;
    expect(noteNode.type).toBe('textnote');
  });

  it('round-trips text note with content as savedwin (known trade-off)', () => {
    const session = new SessionTreeNode();
    const note = new TextNoteTreeNode({ note: 'My note' });
    session.insertSubnode(0, note);

    const html = treeToHtml(session);
    const parsed = parseHtmlTreeDrop(html);

    expect(parsed).not.toBeNull();
    // Text notes with content reimport as savedwin — accepted trade-off
    const noteNode = parsed!.s![0].n;
    expect(noteNode.type).toBe('savedwin');
    expect(noteNode.marks?.customTitle).toBe('My note');
  });
});
