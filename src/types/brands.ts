/**
 * Branded types for type-safe IDs with zero runtime cost.
 *
 * Uses a phantom brand property that exists only at compile time,
 * preventing accidental assignment between structurally identical types.
 */

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** MVC communication ID — string like "idmvc42" */
export type MvcId = Brand<string, 'MvcId'>;

/** Node identity ID — string like "tab42", "win7" */
export type NodeId = Brand<string, 'NodeId'>;

/** Diff ID — integer counter used for change tracking */
export type DiffId = Brand<number, 'DiffId'>;

/** Serialized form of DiffId — base-36 encoded string */
export type DiffIdStr = Brand<string, 'DiffIdStr'>;
