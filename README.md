# zustand-middleware-pipe

Translations: [한국어](docs/i18n/README.ko.md) · [日本語](docs/i18n/README.ja.md)

[![npm version](https://img.shields.io/npm/v/zustand-middleware-pipe)](https://www.npmjs.com/package/zustand-middleware-pipe)
[![license](https://img.shields.io/npm/l/zustand-middleware-pipe)](LICENSE)
[![ESM only](https://img.shields.io/badge/ESM-only-blue)](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)

Write stacked Zustand middleware in the order you actually think about it.

## Quick start

```sh
npm install zustand-middleware-pipe zustand
```

```ts
import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import { devtools, persist, subscribeWithSelector } from 'zustand-middleware-pipe/middleware'

const useCounterStore = create<CounterState>()(
  pipe
    .use(devtools({ name: 'CounterStore' }))
    .use(subscribeWithSelector())
    .use(persist<CounterState>({ name: 'counter' }))
    .use(immer())
    .create((set) => ({
      count: 0,
      inc: () => set((state) => { state.count += 1 }, false, 'counter/inc'),
    })),
)
```

That is it. No magic store replacement. No new state model. Just a tiny userland helper that makes dense middleware stacks readable again.

This package is based on the idea discussed in [pmndrs/zustand#3449](https://github.com/pmndrs/zustand/discussions/3449).

---

## The problem: middleware stacks read backwards

Zustand middleware is written as nested wrappers around a base creator. The outermost wrapper is easy to see, but the base creator is buried at the deepest level. Once you have four middleware in the stack, options and state logic spread across several indentation levels:

```ts
// wrapper order: devtools → subscribeWithSelector → persist → immer → base creator
const useCounterStore = create<CounterState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set) => ({
          count: 0,
          inc: () => set((state) => { state.count += 1 }),
        })),
        { name: 'counter' },
      ),
    ),
    { name: 'CounterStore' },
  ),
)
```

Options end up scattered: `persist` options are buried in the middle, `devtools` options sit at the bottom of the file, and the next reader has to mentally unwrap every layer just to understand the store shape.

## The fix: write the stack as a pipeline

`pipe` lets the same wrapper stack be written top-to-bottom, with the base creator last:

```ts
// writing order matches the nested wrapper expression ↓
pipe
  .use(devtools({ name: 'CounterStore' }))
  .use(subscribeWithSelector())
  .use(persist<CounterState>({ name: 'counter' }))
  .use(immer())
  .create((set) => ({ ... }))
```

### Before / After

| | Before (inside-out) | After (pipe) |
|---|---|---|
| **Reading order** | Outermost wrapper first, base creator buried deepest | Top-to-bottom, ending at `.create(...)` |
| **Options location** | Scattered across nesting levels | Inline with each `.use(...)` call |
| **`set` type** | Inferred by nesting | Accumulated by the builder chain |
| **Adding middleware** | Wrap the whole expression again | Insert `.use(...)` at the matching wrapper position |

The evaluation result is identical:

```ts
// pipe produces exactly this at runtime
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

---

## Install

```sh
npm install zustand-middleware-pipe zustand
```

Install `immer` only if your stack includes `immer()`:

```sh
npm install immer
```

This package is **ESM-only** and assumes bundler-style module resolution for its internal relative imports.

---

## API

```ts
pipe.use(devtools(options?))
  .use(subscribeWithSelector())
  .use(persist<T, PersistedState>(options))
  .use(immer())
  .create(baseCreator)
```

### Middleware wrappers

```ts
immer()
persist<T, PersistedState = T, PersistReturn = unknown>(options)
subscribeWithSelector()
devtools(options?)
combine(initialState, creator)   // use inside .create()
redux(reducer, initialState)     // use inside .create()
```

### Import paths

Non-Immer wrappers and storage helpers come from the middleware barrel. Immer has its own subpath to keep it an optional peer:

```ts
import { pipe } from 'zustand-middleware-pipe'

import { immer } from 'zustand-middleware-pipe/middleware/immer'

import {
  combine,
  createJSONStorage,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
```

### How the builder chain provides type safety

`pipe.use(...)` accumulates mutator types as you add middleware. The final `.create(baseCreator)` receives the fully-composed `set` type, so TypeScript checks each middleware's contribution:

- `.use(immer())` → draft mutation becomes valid inside `.create(...)`
- `.use(devtools(...))` → action-name third argument to `set` becomes valid
- `.use(subscribeWithSelector())` → selector-subscribe overload appears on the store

Remove a `.use(...)` call, and the corresponding capability disappears from the type immediately:

```ts
create<CounterState>()(
  pipe
    .use(persist<CounterState>({ name: 'counter' }))
    // .use(immer()) ← remove this and the draft mutation below is a TypeScript error
    .create((set) => ({
      count: 0,
      inc: () =>
        set((state) => {
          state.count += 1 // ← error: set does not accept a function here
        }),
    })),
)
```

### `persist` with partial state

Pass the persisted-state type as a second generic when using `partialize`:

```ts
pipe
  .use(devtools({ name: 'CounterStore' }))
  .use(subscribeWithSelector())
  .use(persist<CounterState, Pick<CounterState, 'count'>>({
    name: 'counter',
    partialize: (state) => ({ count: state.count }),
  }))
  .create((set) => ({
    count: 0,
    inc: () => set((state) => ({ count: state.count + 1 }), false, 'counter/inc'),
  }))
```

### `combine` and `redux`

`combine` and `redux` are Zustand state-creator helpers, not middleware, so they belong inside `.create(...)`:

```ts
const useCombinedCounterStore = create<CounterState>()(
  pipe
    .use(devtools({ name: 'CombinedCounterStore' }))
    .create(
      combine({ count: 0 }, (set) => ({
        inc: () => set((state) => ({ count: state.count + 1 })),
      })),
    ),
)

type CounterAction = { type: 'inc' }
type Dispatch = (action: CounterAction) => CounterAction

const useReduxCounterStore = create<CounterState & { dispatch: Dispatch }>()(
  pipe
    .use(devtools({ name: 'ReduxCounterStore' }))
    .create(redux(reducer, { count: 0 })),
)
```

---

## Important caveats

- **Not official Zustand guidance.** This is a userland experiment.
- **Do not rewrite working stores** just to use this helper.
- **Bundler resolution is expected.** The package is emitted as ESM with extensionless internal relative imports, so consume it through a bundler-compatible toolchain.
- **Built-in wrapper order and duplicates are enforced.** Add package-provided wrappers outer-to-inner: `.use(devtools(...))` → `.use(subscribeWithSelector())` → `.use(persist(...))` → `.use(immer())`. TypeScript and the runtime `.use(...)` boundary reject reversed built-in order and duplicate package built-ins.
- **Runtime guards are scoped to tagged package built-ins.** Only wrappers returned by this package's `devtools`, `subscribeWithSelector`, `persist`, and `immer` adapters are checked; arbitrary untagged, userland, or third-party middleware is not introspected for order or duplicates.
- **Direct reexports keep Zustand helper semantics.** `combine`, `redux`, and `createJSONStorage` are direct Zustand helpers; `combine` and `redux` belong inside `.create(...)`, not `.use(...)`, and `immer` remains available from the dedicated `zustand-middleware-pipe/middleware/immer` subpath.
- **`store.devtools` availability** depends on normal Zustand devtools behavior. It may not exist when devtools are disabled or the Redux DevTools extension is absent.
- **Third-party middleware** is not automatically composable. Wrappers need correct mutator tuple types to work with the builder.

---

## Development

```sh
npm install
npm run verify
```

`npm run verify` runs typecheck, Vitest, and declaration build.

## Example

The Vite React example lives in `examples/` and uses this package through a local `file:..` dependency.

```sh
npm run example:install
npm run example:dev
```

Use `npm run example:verify` to build and lint the example from the package root.
