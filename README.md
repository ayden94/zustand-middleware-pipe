# zustand-middleware-pipe

Translations: [한국어](docs/i18n/README.ko.md) · [日本語](docs/i18n/README.ja.md)

[![npm version](https://img.shields.io/npm/v/zustand-middleware-pipe)](https://www.npmjs.com/package/zustand-middleware-pipe)
[![license](https://img.shields.io/npm/l/zustand-middleware-pipe)](LICENSE)
[![ESM only](https://img.shields.io/badge/ESM-only-blue)](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)

Write stacked Zustand middleware in the order you actually think about it.

## Quick start

In an existing React project, install the package and the dependencies used by this example:

```sh
npm install zustand-middleware-pipe zustand immer
```

```ts
import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import { devtools, persist, subscribeWithSelector } from 'zustand-middleware-pipe/middleware'

type CounterState = {
  count: number
  inc: () => void
}

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

`pipe` is a middleware pipeline builder. It lets the same wrapper stack be written top-to-bottom, with the base creator last:

```ts
// writing order matches the nested wrapper expression ↓
pipe
  .use(devtools({ name: 'CounterStore' }))
  .use(subscribeWithSelector())
  .use(persist<CounterState>({ name: 'counter' }))
  .use(immer())
  .create((set) => ({ ... }))
```

The evaluation result is identical:

```ts
// pipe produces exactly this at runtime
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

### Before / After

| | Before (inside-out) | After (pipe) |
|---|---|---|
| **Reading order** | Outermost wrapper first, base creator buried deepest | Top-to-bottom, ending at `.create(...)` |
| **Options location** | Scattered across nesting levels | Inline with each `.use(...)` call |
| **`set` type** | Inferred by nesting | Accumulated by the builder chain |
| **Adding middleware** | Wrap the whole expression again | Insert `.use(...)` at the matching wrapper position |

---

## Refactoring existing stores with an LLM

For larger stores, use [`docs/llm-context.md`](docs/llm-context.md) as the canonical LLM input. For copy/paste prompts outside this repository, use the raw GitHub URL: `https://raw.githubusercontent.com/zustandjs/zustand-middleware-pipe/refs/heads/main/docs/llm-context.md`. It gives the model the package import rules, middleware order rules, type caveats, before/after examples, and safety checklist in one place.

If your tool supports file references, attach or mention `@docs/llm-context.md`; otherwise provide the raw URL or paste the document contents before the store code. This is most useful for dense stacks such as `devtools(subscribeWithSelector(persist(immer(...))))`, where options are scattered across several indentation levels.

Ask the model to preserve behavior first:

- Keep the existing middleware wrapper order unchanged.
- Preserve state shape, action names, persistence keys, storage, migrations, and devtools options.
- Keep `combine(...)` and `redux(...)` inside `.create(...)` when they are the innermost state creator helper.
- Add only the imports that are actually used.
- Run typecheck and relevant tests after the refactor.

```md
Read this LLM context first and use it as the rules for this refactor:
https://raw.githubusercontent.com/zustandjs/zustand-middleware-pipe/refs/heads/main/docs/llm-context.md

Refactor this Zustand store to use `zustand-middleware-pipe`.

- Preserve runtime behavior first.
- Keep the middleware wrapper order unchanged: outermost wrapper first, base creator last.
- Move wrappers into `pipe.use(...)` in the same outside-to-inside order.
- Put the innermost state creator into `.create(...)`.
- Run typecheck and relevant tests after the refactor.
```

Do not rewrite a simple working store just to use this helper. Reach for the LLM context when the existing middleware stack is hard to read or easy to break by hand.

---

## Install

```sh
npm install zustand-middleware-pipe zustand
```

Install `immer` only if your stack includes `immer()`:

```sh
npm install immer
```

Install `zundo` only if your stack includes `temporal()`:

```sh
npm install zundo
```

The zundo adapter currently imports Zustand's React entry point, so it also needs React 18 or later. React projects already provide it; in a vanilla project, install it with `npm install react` before importing the zundo adapter. The root and core middleware entry points do not require React for vanilla stores.

This package is **ESM-only** and supports TypeScript's `bundler` and `NodeNext` module resolution.

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
temporal<TState, UState = TState>(options?) // use from /middleware/zundo
persist<T, PersistedState = T, PersistReturn = unknown>(options)
subscribeWithSelector()
devtools(options?)
combine(initialState, creator)   // use inside .create()
redux(reducer, initialState)     // use inside .create()
```

### Import paths

Core wrappers and storage helpers come from the middleware barrel. Optional adapters stay on dedicated subpaths so their peer packages are only needed when you import them:

```ts
import { pipe } from 'zustand-middleware-pipe'

import { immer } from 'zustand-middleware-pipe/middleware/immer'
import { temporal } from 'zustand-middleware-pipe/middleware/zundo'

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
          state.count += 1 // ← error: a non-Immer updater must return the next state
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

### `zundo` temporal history

Use the zundo subpath when you want undo/redo history. Install `zundo` separately, then add `temporal<CounterState>()` to the pipe:

```ts
import { temporal } from 'zustand-middleware-pipe/middleware/zundo'

const useCounterStore = create<CounterState>()(
  pipe
    .use(temporal<CounterState>({ limit: 50 }))
    .create((set) => ({
      count: 0,
      inc: () => set((state) => ({ count: state.count + 1 })),
    })),
)

useCounterStore.temporal.getState().undo()
```

`temporal<CounterState>()` keeps zundo's own mutator typing, including `store.temporal`. Supply the full store state as the first generic unless a typed options callback or an explicit middleware type provides that inference. The later `.create(...)` call does not infer the history type retroactively.

For partial history, use `temporal<CounterState, Pick<CounterState, 'count'>>({ partialize: (state) => ({ count: state.count }) })`. `pastStates` and `futureStates` are arrays of `Partial<UState>`. `partialize` receives the full state; `equality` receives `UState`, and `diff` receives `Partial<UState>`. The adapter preserves upstream option declarations: zundo 2.3.0 types `onSave` with the full state but passes projected values at runtime when `partialize` is used, so do not rely on excluded fields in that callback.

Bare `temporal()` with no inferred full-state type remains supported for compatibility but is deprecated in editor hints because its history state is `unknown`. Options such as `{ limit: 50 }` do not provide a state inference source either; use `temporal<CounterState>({ limit: 50 })`. Generic factories returning `temporal<T>()`, annotated callbacks, and explicit middleware type contexts remain supported.

If you also persist the main store or the temporal store, follow zundo's `wrapTemporal` guidance; this package does not infer a universal safe order for every zundo + persistence setup.

You can also use `pipe` inside `wrapTemporal` when you want to persist the undo/redo history store itself:

```ts
import { pipe } from 'zustand-middleware-pipe'
import { createJSONStorage, persist } from 'zustand-middleware-pipe/middleware'
import {
  temporal,
  type TemporalState,
} from 'zustand-middleware-pipe/middleware/zundo'

type CounterHistory = TemporalState<CounterState>
type PersistedCounterHistory = Pick<CounterHistory, 'futureStates' | 'pastStates'>

pipe
  .use(
    temporal<CounterState>({
      wrapTemporal: (temporalCreator) =>
        pipe
          .use(
            // Preserve the creator's full state, including zundo internals.
            persist<ReturnType<typeof temporalCreator>, PersistedCounterHistory>({
              name: 'counter-history',
              storage: createJSONStorage<PersistedCounterHistory>(() => localStorage),
              partialize: (history) => ({
                futureStates: history.futureStates,
                pastStates: history.pastStates,
              }),
            }),
          )
          .create(temporalCreator),
    }),
  )
  .create((set) => ({ ... }))
```

The outer `pipe` composes the main store. The inner `pipe` composes zundo's temporal history store.

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

### Userland middleware metadata

`definePipeableMiddleware` tags a correctly typed userland middleware with an explicit id and optional policy metadata. The helper returns the same middleware function, so Zustand mutator tuple typing still comes from the middleware itself:

```ts
const temporal = definePipeableMiddleware(temporalMiddleware, {
  id: 'zundo/temporal',
  duplicate: 'reject',
  order: {
    after: ['zustand/persist'],
    before: ['zustand/immer'],
  },
})

pipe
  .use(persist<CounterState>({ name: 'counter' }))
  .use(temporal)
  .use(immer())
  .create((set) => ({ ... }))
```

`order.before` and `order.after` are checked only against ids that are present in the current pipe chain. Unknown or absent targets are ignored, cycles are rejected, and reserved built-in ids such as `zustand/persist` cannot be reused by public userland metadata.

Repeated ids are allowed only when every instance explicitly uses `duplicate: 'allow'`. The default is `'reject'`; any rejecting instance prevents repetition, regardless of insertion order.

---

## Important caveats

- **Not official Zustand guidance.** This is a userland experiment.
- **Do not rewrite working stores** just to use this helper.
- **Native ESM paths.** Runtime JavaScript and declarations use explicit `.js` relative specifiers. Native Node imports and both `NodeNext` and bundler TypeScript consumers are supported.
- **Built-in wrapper order and duplicates are enforced.** Add package-provided wrappers outer-to-inner: `.use(devtools(...))` → `.use(subscribeWithSelector())` → `.use(persist(...))` → `.use(immer())`. TypeScript and the runtime `.use(...)` boundary reject reversed built-in order and duplicate package built-ins.
- **Runtime guards are scoped to tagged pipeable wrappers.** Package built-ins (`devtools`, `subscribeWithSelector`, `persist`, `immer`) and opt-in adapters such as `zundo` carry explicit metadata for duplicate/order checks. Arbitrary untagged, userland, or third-party middleware is not introspected for order or duplicates.
- **Userland order metadata is opt-in.** `definePipeableMiddleware` only trusts explicit ids and `order.before` / `order.after` hints. It does not inspect function names or source code, and it does not make arbitrary third-party middleware automatically safe.
- **Direct reexports keep Zustand helper semantics.** `combine`, `redux`, and `createJSONStorage` are direct Zustand helpers; `combine` and `redux` belong inside `.create(...)`, not `.use(...)`, and `immer` remains available from the dedicated `zustand-middleware-pipe/middleware/immer` subpath.
- **Optional third-party adapters stay on dedicated subpaths.** `zundo` is available from `zustand-middleware-pipe/middleware/zundo` and requires installing `zundo` in the consuming app.
- **`store.devtools` availability** depends on normal Zustand devtools behavior. It may not exist when devtools are disabled or the Redux DevTools extension is absent.
- **Third-party middleware** is not automatically composable. Wrappers need correct mutator tuple types to work with the builder.

---

## Development

```sh
npm install
npm run verify
```

`npm run verify` runs typecheck, Vitest, the build, and native Node export/package checks.

## Example

The Vite React example lives in `examples/` and uses this package through a local `file:..` dependency.

```sh
npm run example:dev
```

`npm run example:dev` prepares the local package before starting Vite; it does not watch the library's `src/` directory. Use `npm run example:verify` to build and lint the example from the package root.

After changing library sources, stop Vite and refresh the installed package and dependency cache:

```sh
npm run example:install
npm run dev --prefix examples -- --force
```
