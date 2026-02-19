/**
 * TileObj represents a visual tile (icon image) used in the tree view
 * for relicons (relationship line icons) and other UI elements.
 */
export interface TileObj {
  readonly src: string;
  readonly w: number;
  readonly h: number;
  readonly className?: string;
}
