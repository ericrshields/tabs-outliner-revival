# 2. System Architecture Overview

See `.specs/architecture.md` for source layout, layer descriptions, and entrypoint descriptions.

---

## 2.1 Dependency Rules

Layers follow strict dependency rules. Arrows indicate "depends on" (can import from):

| Layer | Can Import From | Cannot Import From |
|-------|----------------|-------------------|
| **Entrypoints** | background, view, chrome, types | (delegates only) |
| **Background** | tree, serialization, storage, chrome, types | view |
| **View** | tree (types only, via `NodeDTO`), chrome (`PortManager`), types | background, serialization, storage |
| **Tree** | types | chrome, serialization, storage, background, view |
| **Serialization** | types | chrome, tree, storage, background, view |
| **Storage** | chrome, serialization, types | tree, background, view |
| **Chrome** | types | tree, serialization, storage, background, view |
| **Types** | (none -- leaf layer) | everything |

Key invariants:

- **Tree and Serialization are pure**: Zero Chrome API dependency. Fully testable with plain unit tests.
- **View never imports from Background**: Communication exclusively through Chrome ports with typed messages.
- **Background never imports from View**: Broadcasts via `ViewBridge` with no knowledge of Preact components.

See `diagrams/system-layers.d2` for the visual representation.

---

## 2.2 Module Boundary Rules

1. **Entrypoints delegate to `src/`**: Entry files contain only WXT boilerplate. All logic lives in `src/`.
2. **No shared code in `entrypoints/`**: Shared code goes in `src/`.
3. **Barrel exports**: `src/chrome/index.ts` re-exports all Chrome wrappers. Import from `@/chrome`.
4. **`@/` path alias**: Resolves to `src/` (see Section 10.2 for resolution details).
5. **Type-only imports across layer boundaries**: View imports tree types (`NodeDTO`, `NodeType`, `MvcId`) but never tree runtime code (`TreeModel`, `TreeNode`).
