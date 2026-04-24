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

1. define the base creator
2. add Immer
3. add Persist
4. add selector subscriptions
5. add DevTools

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
const baseCreator = definePipeStateCreator<
  CounterState,
  'immer' | 'persist' | 'subscribeWithSelector' | 'devtools'
>((set) => ({
  count: 0,
  inc: () =>
    set(
      (state) => {
        state.count += 1
      },
      false,
      'counter/inc',
    ),
}))

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

That code evaluates to the same nested middleware stack:

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
definePipeStateCreator<T, Middlewares>(baseCreator)
pipe(base, ...wrappers)
pipeStateCreator(base, ...wrappers) // compatibility alias
withImmer()
withPersist<T, PersistedState = T, PersistReturn = unknown>(options)
withSubscribeWithSelector()
withDevtools(options?)
```

`pipe` is the primary API and supports typed composition overloads up to seven wrappers. `pipeStateCreator` is kept as a compatibility alias while the PoC API settles. The middleware wrappers preserve Zustand v5's mutator tuple types for the common built-in middlewares.

`definePipeStateCreator<T, Middlewares>(baseCreator)` is a typed identity helper for defining the base state creator before passing it to `pipe(...)`. It does **not** replace Zustand's `create` or `createStore`; it only gives the base creator the selected built-in pipe stack type so middleware-specific `set` overloads work without hand-writing the mutator tuple. Pass the middleware names you use as a union type; the helper maps them to Zustand's canonical mutator order internally.

```ts
const baseCreator = definePipeStateCreator<
  CounterState,
  'persist' | 'subscribeWithSelector' | 'devtools'
>((set) => ({
  count: 0,
  inc: () =>
    set((state) => ({ count: state.count + 1 }), false, 'counter/inc'),
}))

const store = createStore<CounterState>()(
  pipe(
    baseCreator,
    withPersist<CounterState>({ name: 'counter' }),
    withSubscribeWithSelector(),
    withDevtools({ name: 'CounterStore' }),
  ),
)
```

The middleware union is also a type-safety contract. If you declare `immer` in
`definePipeStateCreator` but forget `withImmer()` in `pipe(...)`, TypeScript
rejects the stack because the base creator still expects the Immer mutator to be
consumed. The opposite mismatch is rejected too: adding `withImmer()` while
omitting `immer` from the union makes the wrapper expect a different input
stack.

```ts
const baseCreator = definePipeStateCreator<
  CounterState,
  'immer' | 'persist'
>((set) => ({
  count: 0,
  inc: () =>
    set((state) => {
      state.count += 1
    }),
}))

createStore<CounterState>()(
  pipe(
    baseCreator,
    // withImmer(), // TypeScript error when this wrapper is missing
    withPersist<CounterState>({ name: 'counter' }),
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
- TypeScript inference can be less contextual than direct `create(...middleware(...))` nesting. For built-in middleware stacks, define the base creator with `definePipeStateCreator<State, 'middlewareName' | ...>((set) => ...)` when you need typed Immer draft updates or devtools action names inside the base creator.
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
