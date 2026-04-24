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
pipe(base, ...wrappers)
pipeStateCreator(base, ...wrappers) // compatibility alias
withImmer()
withPersist<T, PersistedState = T, PersistReturn = unknown>(options)
withSubscribeWithSelector()
withDevtools(options?)
```

`pipe` is the primary API and supports typed composition overloads up to seven wrappers. `pipeStateCreator` is kept as a compatibility alias while the PoC API settles. The middleware wrappers preserve Zustand v5's mutator tuple types for the common built-in middlewares.

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
- TypeScript inference can be less contextual than direct `create(...middleware(...))` nesting. For complex stacks, define the base creator separately and annotate it with `StateCreator`.
- Arbitrary third-party middleware composition is not solved by the runtime `reduce`; wrappers need correct mutator tuple types.

## Development

```sh
npm install
npm run verify
```

`npm run verify` runs typecheck, Vitest, and declaration build.
