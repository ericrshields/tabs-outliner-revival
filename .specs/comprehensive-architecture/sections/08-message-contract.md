# 8. Message Contract Reference

> **Source**: `src/types/messages.ts` -- complete union types for all inter-process messages.

See `.specs/architecture.md` for the key messages table.

---

## Discriminant Fields

| Direction | Discriminant Field | Prefix Convention |
|---|---|---|
| Background -> View | `command` | `msg2view_*` |
| View -> Background | `request` | `request2bkg_*` |

All message interfaces have their discriminant field as `readonly`.

## Catch-All Generic Types

Both unions include a catch-all (`Msg_BackgroundToViewGeneric` / `Req_ViewToBackgroundGeneric`) with `readonly [key: string]: unknown`. This enables incremental typing: new messages start as generic, then get promoted to fully typed interfaces. Handlers use `default` case rather than compile-time exhaustiveness.

## Heartbeat Filtering

`PortManager` sends `{ __heartbeat: true }` which is NOT part of either message union. Background-side handlers must filter it: `if ('__heartbeat' in msg) return;`

## Exhaustive Switch Pattern

Handlers switch on the discriminant field (`command` or `request`). TypeScript narrows the message type in each case branch. The generic catch-all in each union means `default` handles unrecognized messages gracefully rather than requiring exhaustive matching -- this supports forward compatibility during incremental typing.
