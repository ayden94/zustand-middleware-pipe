# zustand-middleware-pipe

Experimental userland helper for composing Zustand middlewares left-to-right.

This package is based on the idea discussed in [pmndrs/zustand#3449](https://github.com/pmndrs/zustand/discussions/3449). The maintainer response was that this direction is fine for a third-party/userland helper, but it is not currently recommended or documented as the official Zustand style.

## Why this exists

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

This helper lets the same runtime order be written left-to-right:

```ts
const baseCreator = definePipeStateCreator(
  ['immer', 'persist', 'subscribeWithSelector', 'devtools'],
  (set): CounterState => ({
    count: 0,
    inc: () =>
      set(
        (state) => {
          state.count += 1
        },
        false,
        'counter/inc',
      ),
  }),
)

const store = createStore<CounterState>()(
  pipe(
    baseCreator,
    withImmer(),
    withPersist<CounterState>({ name: 'counter' }),
    withSubscribeWithSelector(),
    withDevtools({ name: 'CounterStore' }),
  ),
)
```

The example above evaluates to:

```ts
devtools(subscribeWithSelector(persist(immer(baseCreator), options)), options)
```

## Install

```sh
npm install zustand-middleware-pipe zustand immer
```

`immer` is currently a hard peer dependency because the root entry point exports `withImmer()` and imports `zustand/middleware/immer` at module load time. If we want non-Immer consumers to avoid installing it, the next packaging step should be a separate `zustand-middleware-pipe/immer` entry point.

This package is ESM-only.

## API

```ts
definePipeStateCreator(middlewares, baseCreator)
pipe(base, ...wrappers)
pipeStateCreator(base, ...wrappers) // compatibility alias
withImmer()
withPersist<T, PersistedState = T, PersistReturn = unknown>(options)
withSubscribeWithSelector()
withDevtools(options?)
```

`pipe` is the primary API and supports typed composition overloads up to seven wrappers. `pipeStateCreator` is kept as a compatibility alias while the PoC API settles. The middleware wrappers preserve Zustand v5's mutator tuple types for the common built-in middlewares.

`definePipeStateCreator(middlewares, baseCreator)` is a typed identity helper for defining the base state creator before passing it to `pipe(...)`. It does **not** replace Zustand's `create` or `createStore`; it only gives the base creator the selected built-in pipe stack type so middleware-specific `set` overloads work without hand-writing the mutator tuple. List only the wrappers you will actually pass to `pipe(...)`, in the same left-to-right order. Annotate the base creator return type so TypeScript can infer the store state while preserving the middleware tuple:

```ts
const baseCreator = definePipeStateCreator(
  ['persist', 'subscribeWithSelector', 'devtools'],
  (set): CounterState => ({
    count: 0,
    inc: () =>
      set((state) => ({ count: state.count + 1 }), false, 'counter/inc'),
  }),
)

const store = createStore<CounterState>()(
  pipe(
    baseCreator,
    withPersist<CounterState>({ name: 'counter' }),
    withSubscribeWithSelector(),
    withDevtools({ name: 'CounterStore' }),
  ),
)
```

When `persist` uses `partialize`, pass the partialized persisted-state type explicitly:

```ts
withPersist<CounterState, Pick<CounterState, 'count'>>({
  name: 'counter',
  partialize: (state) => ({ count: state.count }),
})
```

## Important caveats

- This is **not official Zustand guidance**.
- Do not rewrite working stores just to use this helper.
- Keep `withDevtools(...)` last in the left-to-right list so `devtools(...)` remains outermost.
- Zustand's devtools type exposes `store.devtools`, but the runtime property depends on normal Zustand devtools behavior. For example, it may not be available when devtools are disabled or no Redux DevTools extension is present.
- TypeScript inference can be less contextual than direct `create(...middleware(...))` nesting. For built-in middleware stacks, define the base creator with `definePipeStateCreator(['middlewareName', ...], (set): State => ...)` when you need typed Immer draft updates or devtools action names inside the base creator.
- Arbitrary third-party middleware composition is not solved by the runtime `reduce`; wrappers need correct mutator tuple types.

## Development

```sh
npm install
npm run verify
```

`npm run verify` runs typecheck, Vitest, and declaration build.
