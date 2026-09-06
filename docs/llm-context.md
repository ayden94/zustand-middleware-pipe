# LLM Context: Refactor Zustand Middleware Stacks with `zustand-middleware-pipe`

Use this document as context when asking an LLM to read, write, or refactor Zustand stores that use `zustand-middleware-pipe`.

## What this package does

`zustand-middleware-pipe` is a small userland helper for composing Zustand middlewares left-to-right. It does not replace Zustand, create a new store model, or change middleware runtime behavior. It only rewrites nested middleware wrappers into a readable pipeline:

```ts
pipe
  .use(devtools({ name: 'CounterStore' }))
  .use(subscribeWithSelector())
  .use(persist<CounterState>({ name: 'counter' }))
  .use(immer())
  .create((set) => ({
    count: 0,
    inc: () => set((state) => { state.count += 1 }, false, 'counter/inc'),
  }))
```

This produces the same wrapper shape as:

```ts
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

The pipeline order is still the nested wrapper order: outermost middleware first, base state creator last.

## Imports to use

Prefer these public import paths:

```ts
import { create } from 'zustand'
import { pipe, definePipeableMiddleware } from 'zustand-middleware-pipe'
import {
  combine,
  createJSONStorage,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import { temporal } from 'zustand-middleware-pipe/middleware/zundo'
```

Only import optional adapters when used:

- `zustand-middleware-pipe/middleware/immer` requires the app to have `immer` installed.
- `zustand-middleware-pipe/middleware/zundo` requires the app to have `zundo` installed.

## Built-in order rules

Package-provided built-ins must be added outer-to-inner:

```ts
pipe
  .use(devtools(options))
  .use(subscribeWithSelector())
  .use(persist<State>(options))
  .use(immer())
  .create(baseCreator)
```

Do not reverse these built-ins and do not add the same package-provided built-in twice. The builder rejects invalid built-in order and duplicates at the `.use(...)` boundary.

`combine` and `redux` are Zustand state-creator helpers, not middleware wrappers. They belong inside `.create(...)`, not inside `.use(...)`:

```ts
create<CounterState>()(
  pipe
    .use(devtools({ name: 'CombinedCounterStore' }))
    .create(
      combine({ count: 0 }, (set) => ({
        inc: () => set((state) => ({ count: state.count + 1 })),
      })),
    ),
)
```

## Refactoring algorithm for LLMs

When converting an existing Zustand store, preserve behavior first and improve readability second.

1. Find the call passed to `create<State>()(...)` or `createStore<State>()(...)`.
2. Identify the nested middleware wrappers from outside to inside.
3. Keep wrapper options attached to the same middleware.
4. Move wrappers into a `pipe.use(...)` chain in the same outside-to-inside order.
5. Put the innermost base state creator into `.create(...)`.
6. Keep `combine(...)` or `redux(...)` inside `.create(...)` if they are the innermost state creator helper.
7. Add only the imports that are actually used.
8. Do not change state shape, action names, persistence keys, storage behavior, selector subscriptions, or devtools options unless explicitly requested.

### Before

```ts
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

### After

```ts
const useCounterStore = create<CounterState>()(
  pipe
    .use(devtools({ name: 'CounterStore' }))
    .use(subscribeWithSelector())
    .use(persist<CounterState>({ name: 'counter' }))
    .use(immer())
    .create((set) => ({
      count: 0,
      inc: () => set((state) => { state.count += 1 }),
    })),
)
```

## Type guidance

The builder accumulates Zustand mutator tuple types as middleware is added. The final `.create(...)` receives the composed `set`, `get`, and store types.

Assume current Zustand v4/v5-style middleware typing: `StateCreator<T, Mps, Mcs, U>` where `Mps` and `Mcs` are mutator tuple lists. Do not copy older custom-middleware examples that use pre-v4 `StoreSetState`, `StoreGetState`, or `StoreApi` generic positions as the primary middleware typing model.

Common built-in mutator ids are:

- `zustand/devtools`
- `zustand/persist`
- `zustand/subscribeWithSelector`
- `zustand/immer`

The pipe wrappers preserve those underlying Zustand middleware capabilities. For example, `devtools()` enables action labels in the third `set` argument, `immer()` enables draft mutation in function updates, `subscribeWithSelector()` adds selector subscribe overloads, and `persist()` adds persistence behavior and hydration options.

Use explicit generics when they clarify persisted or temporal state:

For zundo, use `temporal<FullStoreState>()` unless an annotated options callback or explicit middleware type supplies full-state inference. For projected history, use `temporal<FullStoreState, HistoryState>(options)`. A later `.create(...)` does not infer history retroactively, and options such as `limit` provide no state inference. A no-options call without an inferred state uses the deprecated compatibility overload with unknown history. Keep the full store type in the first generic and the history subset in the second; snapshots remain `Partial<HistoryState>[]`.

```ts
type PersistedCounterState = Pick<CounterState, 'count'>

pipe
  .use(persist<CounterState, PersistedCounterState>({
    name: 'counter',
    partialize: (state) => ({ count: state.count }),
  }))
  .create((set) => ({
    count: 0,
    inc: () => set((state) => ({ count: state.count + 1 })),
  }))
```

Do not use type suppression to force a pipeline to compile. If types fail, the middleware order, import path, or state creator type is probably wrong.

## Good refactor opportunities

Use the pipe when it makes an existing Zustand store easier to read. Good candidates include:

- Deeply nested middleware such as `devtools(subscribeWithSelector(persist(immer(...))))`.
- Stores where middleware options are scattered across different indentation levels.
- Stores that already use `persist` with `partialize`, `version`, `migrate`, custom `storage`, or hydration callbacks.
- Stores that use `subscribeWithSelector` and need selector subscribe overloads to remain visible in the final store type.
- Stores that use `immer` and rely on draft mutation inside `set((state) => { ... })`.
- Stores that use `devtools` action labels through `set(update, replace, 'domain/action')`.

## Userland middleware

Third-party or custom middleware is not automatically inspected for order or duplicates. If a custom middleware should participate in pipe metadata checks, tag it with `definePipeableMiddleware`:

```ts
const customMiddleware = definePipeableMiddleware(rawMiddleware, {
  id: 'app/custom-middleware',
  duplicate: 'reject',
  order: {
    after: ['zustand/persist'],
    before: ['zustand/immer'],
  },
})
```

Use a unique non-reserved id. Built-in ids such as `zustand/persist` and `zustand/immer` are reserved for package-provided wrappers.

## Safe rewrite checklist

Before returning a refactor, verify:

- The wrapper order is unchanged.
- `devtools`, `persist`, `subscribeWithSelector`, `immer`, and `temporal` options are preserved.
- `persist` names, storage, `partialize`, hydration callbacks, and version/migration options are preserved.
- `combine(...)` and `redux(...)` remain inside `.create(...)`.
- Optional imports use their dedicated subpaths.
- No type suppressions, broad casts, or behavior-changing cleanups were introduced.
- Typecheck and relevant tests pass.

## When not to refactor

Do not rewrite a working store just to use this helper if the middleware stack is already simple. This package is most useful when nested middleware makes a store hard to read, options are scattered across indentation levels, or adding another middleware would require wrapping an already dense expression.
