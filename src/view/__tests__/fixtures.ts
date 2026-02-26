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
    customTitle: null,
    hoveringMenuActions: {} as Partial<
      Record<HoveringMenuActionId, { id: HoveringMenuActionId }>
    >,
    statsBlockData: null as StatsBlock | null,
    icon: '',
    iconForHtmlExport: '',
    tooltipText: '',
    href: null,
    nodeText: 'Test Node',
    isSelectedTab: false,
    isFocusedWindow: false,
    isProtectedFromGoneOnClose: false,
    nodeContentCssClass: '',
    nodeTextCustomStyle: null,
    isSubnodesPresent: false,
  };

  return { ...defaults, ...overrides } as NodeDTO;
}

/** Build a tree: root with windows, each window with tabs. */
export function makeTree(): NodeDTO {
  const tab1 = makeNodeDTO({
    idMVC: 'tab1' as MvcId,
    nodeText: 'GitHub',
    icon: 'icon-tab',
    titleBackgroundCssClass: 'tabFrame',
  });

  const tab2 = makeNodeDTO({
    idMVC: 'tab2' as MvcId,
    nodeText: 'Stack Overflow',
    icon: 'icon-tab',
    titleBackgroundCssClass: 'tabFrame',
  });

  const tab3 = makeNodeDTO({
    idMVC: 'tab3' as MvcId,
    nodeText: 'MDN Docs',
    icon: 'icon-tab',
    titleBackgroundCssClass: 'tabFrame',
    colapsed: false,
  });

  const window1 = makeNodeDTO({
    idMVC: 'win1' as MvcId,
    nodeText: 'Main Window',
    icon: 'icon-window',
    titleBackgroundCssClass: 'windowFrame',
    colapsed: false,
    subnodes: [tab1, tab2],
    isSubnodesPresent: true,
  });

  const window2 = makeNodeDTO({
    idMVC: 'win2' as MvcId,
    nodeText: 'Saved Window',
    icon: 'icon-window',
    titleBackgroundCssClass: 'windowFrame',
    colapsed: true,
    subnodes: [],
    isSubnodesPresent: true,
  });

  const window3 = makeNodeDTO({
    idMVC: 'win3' as MvcId,
    nodeText: 'Research',
    icon: 'icon-window',
    titleBackgroundCssClass: 'windowFrame',
    colapsed: false,
    subnodes: [tab3],
    isSubnodesPresent: true,
  });

  return makeNodeDTO({
    idMVC: 'root' as MvcId,
    nodeText: 'Session Root',
    colapsed: false,
    subnodes: [window1, window2, window3],
    isSubnodesPresent: true,
  });
}
