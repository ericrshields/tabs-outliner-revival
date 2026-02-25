/**
 * Test fixture builder for NodeDTO trees.
 *
 * Provides a `makeNodeDTO()` helper that creates minimally valid NodeDTO
 * objects with sensible defaults, overridable via partial options.
 */

import type { MvcId } from '@/types/brands';
import type { NodeDTO, StatsBlock } from '@/types/node-dto';
import type { HoveringMenuActionId, TitleBackgroundCssClass } from '@/types/node';
import type { NodeMarks } from '@/types/marks';

let counter = 0;

/** Reset the auto-increment counter between tests. */
export function resetFixtureCounter(): void {
  counter = 0;
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function makeNodeDTO(overrides: DeepPartial<NodeDTO> = {}): NodeDTO {
  const id = (overrides.idMVC as string) ?? `idmvc${++counter}`;
  const mvcId = id as MvcId;

  const defaults: NodeDTO = {
    id: mvcId,
    idMVC: mvcId,
    colapsed: false,
    subnodes: [],
    titleCssClass: 'defaultTitle',
    titleBackgroundCssClass: 'defaultFrame' as TitleBackgroundCssClass,
    marks: { relicons: [] } as NodeMarks,
    _getCustomTitle: null,
    _hoveringMenuActions: {} as Partial<
      Record<HoveringMenuActionId, { id: HoveringMenuActionId }>
    >,
    _countSubnodesStatsBlockData: null as StatsBlock | null,
    _getIcon: '',
    _getIconForHtmlExport: '',
    _getTooltipText: '',
    _getHref: null,
    _getNodeText: 'Test Node',
    _isSelectedTab: false,
    _isFocusedWindow: false,
    _isProtectedFromGoneOnClose: false,
    _getNodeContentCssClass: '',
    _getNodeTextCustomStyle: null,
    _isSubnodesPresent: false,
  };

  return { ...defaults, ...overrides } as NodeDTO;
}

/** Build a tree: root with windows, each window with tabs. */
export function makeTree(): NodeDTO {
  const tab1 = makeNodeDTO({
    idMVC: 'tab1' as MvcId,
    _getNodeText: 'GitHub',
    _getIcon: 'icon-tab',
    titleBackgroundCssClass: 'tabFrame',
  });

  const tab2 = makeNodeDTO({
    idMVC: 'tab2' as MvcId,
    _getNodeText: 'Stack Overflow',
    _getIcon: 'icon-tab',
    titleBackgroundCssClass: 'tabFrame',
  });

  const tab3 = makeNodeDTO({
    idMVC: 'tab3' as MvcId,
    _getNodeText: 'MDN Docs',
    _getIcon: 'icon-tab',
    titleBackgroundCssClass: 'tabFrame',
    colapsed: false,
  });

  const window1 = makeNodeDTO({
    idMVC: 'win1' as MvcId,
    _getNodeText: 'Main Window',
    _getIcon: 'icon-window',
    titleBackgroundCssClass: 'windowFrame',
    colapsed: false,
    subnodes: [tab1, tab2],
    _isSubnodesPresent: true,
  });

  const window2 = makeNodeDTO({
    idMVC: 'win2' as MvcId,
    _getNodeText: 'Saved Window',
    _getIcon: 'icon-window',
    titleBackgroundCssClass: 'windowFrame',
    colapsed: true,
    subnodes: [],
    _isSubnodesPresent: true,
  });

  const window3 = makeNodeDTO({
    idMVC: 'win3' as MvcId,
    _getNodeText: 'Research',
    _getIcon: 'icon-window',
    titleBackgroundCssClass: 'windowFrame',
    colapsed: false,
    subnodes: [tab3],
    _isSubnodesPresent: true,
  });

  return makeNodeDTO({
    idMVC: 'root' as MvcId,
    _getNodeText: 'Session Root',
    colapsed: false,
    subnodes: [window1, window2, window3],
    _isSubnodesPresent: true,
  });
}
