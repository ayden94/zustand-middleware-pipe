# zustand-middleware-pipe

Translations: [한국어](docs/i18n/README.ko.md) · [日本語](docs/i18n/README.ja.md)

Write stacked Zustand middleware in the order you actually think about it.

If you have ever mixed `immer`, `persist`, `subscribeWithSelector`, and
`devtools` in one Zustand store, you have probably had this moment:

> “Wait... which options belong to which middleware again?”

Zustand's normal inside-out middleware style is powerful, but once the stack
gets real, the code starts reading backwards. `persist` options sit in the
middle, `devtools` wraps everything from the outside, `immer` changes the `set`
type from the inside, and the next person has to mentally unwrap the whole
thing just to understand the store setup.

`zustand-middleware-pipe` keeps the same runtime behavior, but lets the setup
read left-to-right:

1. start a typed pipe builder
2. add Immer
3. add Persist
4. add selector subscriptions
5. add DevTools
6. create the base state creator with the final `set` type already known

No magic store replacement. No new state model. Just a tiny userland helper for
making dense middleware stacks readable again.

This package is based on the idea discussed in [pmndrs/zustand#3449](https://github.com/pmndrs/zustand/discussions/3449).

## The problem: middleware stacks read backwards

Zustand middleware stacks are normally written inside-out:

```ts
const store = createStore<CounterState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set) => ({
          count: 0,
          inc: () =>
            set((state) => {
              state.count += 1
            }),
        })),
        { name: 'counter' },
      ),
    ),
    { name: 'CounterStore' },
  ),
)
```

This is correct Zustand code, but the shape gets harder to scan as the stack
grows. The runtime order is hidden in the nesting.

## The fix: write the stack as a pipeline

This helper lets the same runtime order be written left-to-right:

```ts
import { pipe } from 'zustand-middleware-pipe'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import {
  devtools,
  persist,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'

const store = createStore<CounterState>()(
  pipe.use(immer())
    .use(persist<CounterState>({ name: 'counter' }))
    .use(subscribeWithSelector())
    .use(devtools({ name: 'CounterStore' }))
    .create((set) => ({
      count: 0,
      inc: () =>
        set(
          (state) => {
            state.count += 1
          },
          false,
          'counter/inc',
        ),
    })),
)
```

That code evaluates to the same nested middleware stack:

```ts
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

`pipe` does not sort middleware for you. It applies the exact `.use()`
order you write: earlier `.use()` calls stay closer to the base creator, and
later `.use()` calls wrap the stack built so far. That means the example above
keeps Zustand's usual shape, with `devtools()` last so `devtools(...)` is
outermost. This matches Zustand's TypeScript guide recommendation to keep
`devtools` as late as possible. For built-in pipe wrappers, `pipe` treats
that order as part of the API contract and reports reversed order at `.use(...)`.

## Install

```sh
npm install zustand-middleware-pipe zustand
```

Install `immer` only if your stack uses `immer()`:

```sh
npm install immer
```

This package is ESM-only.

## API

```ts
pipe.use(immer())
  .use(persist<T, PersistedState>(options))
  .use(subscribeWithSelector())
  .use(devtools(options?))
  .create(baseCreator)

immer()
persist<T, PersistedState = T, PersistReturn = unknown>(options)
subscribeWithSelector()
devtools(options?)
combine(initialState, creator)
redux(reducer, initialState)
```

`pipe.use(...)` is the primary API. It keeps the middleware list as the only source of truth, so the base creator receives the right `set` type from the builder chain. If you use `immer()`, draft mutation is available in `.create(...)`; if you use `devtools(...)`, action names are accepted; if you use `subscribeWithSelector()`, the final store gets the selector subscribe overload.

Import non-Immer wrappers from the middleware barrel, and import Immer from its dedicated subpath:

```ts
import { immer } from 'zustand-middleware-pipe/middleware/immer'
import {
  combine,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
```

The root entry point does not import any middleware wrappers. The middleware barrel also avoids importing `immer`, so non-Immer consumers can use `persist`, `subscribeWithSelector`, `devtools`, `combine`, and `redux` without touching the optional Immer peer. The wrapper names intentionally mirror Zustand's middleware names; the package subpath is what makes the pipe-aware wrappers explicit.

```ts
const store = createStore<CounterState>()(
  pipe.use(persist<CounterState, Pick<CounterState, 'count'>>({
    name: 'counter',
    partialize: (state) => ({ count: state.count }),
  }))
    .use(subscribeWithSelector())
    .use(devtools({ name: 'CounterStore' }))
    .create((set) => ({
      count: 0,
      inc: () =>
        set((state) => ({ count: state.count + 1 }), false, 'counter/inc'),
    })),
)
```

`combine(...)` and `redux(...)` are official Zustand state creator helpers, so they belong in `.create(...)` rather than `.use(...)`:

```ts
type CounterAction = { type: 'inc' }
type Dispatch = (action: CounterAction) => CounterAction

const combinedStore = createStore<CounterState>()(
  pipe
    .use(devtools({ name: 'CombinedCounterStore' }))
    .create(
      combine({ count: 0 }, (set) => ({
        inc: () => set((state) => ({ count: state.count + 1 })),
      })),
    ),
)

const reduxStore = createStore<CounterState & { dispatch: Dispatch }>()(
  pipe
    .use(devtools({ name: 'ReduxCounterStore' }))
    .create(redux(reducer, { count: 0 })),
)
```

The builder chain is the type-safety contract. If you remove `.use(immer())`, draft mutation inside `.create(...)` stops type-checking. If you remove `.use(devtools(...))`, the action-name argument passed to `set` stops type-checking.

```ts
createStore<CounterState>()(
  pipe
    // .use(immer()) // TypeScript error in the creator when this middleware is missing
    .use(persist<CounterState>({ name: 'counter' }))
    .create((set) => ({
      count: 0,
      inc: () =>
        set((state) => {
          state.count += 1
        }),
    })),
)
```

When `persist` uses `partialize`, pass the persisted-state type to `persist`:

```ts
persist<CounterState, Pick<CounterState, 'count'>>({
  name: 'counter',
  partialize: (state) => ({ count: state.count }),
})
```

## Important caveats

- This is **not official Zustand guidance**.
- Do not rewrite working stores just to use this helper.
- Built-in wrappers must be added from inner to outer: `.use(immer())`, `.use(persist(...))`, `.use(subscribeWithSelector())`, then `.use(devtools(...))`. Reversed built-in order is rejected at `.use(...)`.
- Zustand's devtools type exposes `store.devtools`, but the runtime property depends on normal Zustand devtools behavior. For example, it may not be available when devtools are disabled or no Redux DevTools extension is present.
- Arbitrary third-party middleware composition is not solved by the runtime `reduce`; wrappers need correct mutator tuple types.

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
