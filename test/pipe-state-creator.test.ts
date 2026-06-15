import { describe, expect, expectTypeOf, it } from 'vitest'
import { createJSONStorage, type StateStorage } from 'zustand/middleware'
import { createStore, type StateCreator } from 'zustand/vanilla'
import * as publicApi from '../src/index.js'
import {
  definePipeStateCreator,
  pipe,
  pipeStateCreator,
  type DevtoolsMutator,
  type ImmerMutator,
  type PersistMutator,
  type PipeMiddlewareStack,
  type PipeCanUseMiddleware,
  type PipeAnyMiddleware,
  type PipeMiddleware,
  type SubscribeWithSelectorMutator,
} from '../src/index.js'
import * as middleware from '../src/middleware.js'
import { immer } from '../src/middleware/immer.js'
import {
  devtools,
  persist,
  subscribeWithSelector,
} from '../src/middleware.js'

interface CounterState {
  count: number
  label: string
  inc: () => void
  setLabel: (label: string) => void
}

type PersistedCounterState = Pick<CounterState, 'count'>

function createMemoryStorage(): StateStorage {
  const values = new Map<string, string>()

  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value)
    },
    removeItem: (name) => {
      values.delete(name)
    },
  }
}

function createOrderMarkerMiddleware<T>(
  name: string,
  events: string[],
): PipeMiddleware<T, [], []> {
  return (initializer) => (set, get, store) => {
    events.push(`${name}:before`)
    const state = initializer(set, get, store)
    events.push(`${name}:after`)
    return state
  }
}

describe('pipe', () => {
  it('composes ordinary wrappers from left to right', () => {
    const result = pipe(
      1,
      (value) => value + 1,
      (value) => `count:${value}`,
    )

    expect(result).toBe('count:2')
    expectTypeOf(result).toEqualTypeOf<string>()
  })

  it('keeps pipeStateCreator as a compatibility alias', () => {
    expect(pipeStateCreator).toBe(pipe)
  })

  it('exports the intended root runtime helpers', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'definePipeStateCreator',
      'pipe',
      'pipeStateCreator',
    ])
    expect('pipeStore' in publicApi).toBe(false)
  })

  it('starts a typed builder from pipe.use', () => {
    const builder = pipe
      .use(immer())
      .use(persist<CounterState, PersistedCounterState>({
        name: 'counter-builder',
        storage: createJSONStorage<PersistedCounterState>(() =>
          createMemoryStorage(),
        ),
        partialize: (state) => ({ count: state.count }),
      }))

    expect(typeof pipe.use).toBe('function')
    expect(typeof builder.use).toBe('function')
    expect(typeof builder.create).toBe('function')
  })

  it('exports non-Immer wrappers from the middleware barrel', () => {
    expect('immer' in middleware).toBe(false)
    expect(typeof middleware.persist).toBe('function')
    expect(typeof middleware.subscribeWithSelector).toBe('function')
    expect(typeof middleware.devtools).toBe('function')
  })

  it('exports Immer from the dedicated middleware subpath', () => {
    expect(typeof immer).toBe('function')
  })

  it('builds a Zustand middleware stack while preserving store extensions', () => {
    const store = createStore<CounterState>()(
      pipe
        .use(immer())
        .use(persist<CounterState, PersistedCounterState>({
          name: 'counter',
          storage: createJSONStorage<PersistedCounterState>(() =>
            createMemoryStorage(),
          ),
          partialize: (state) => ({ count: state.count }),
        }))
        .use(subscribeWithSelector())
        .use(devtools({ name: 'CounterStore', enabled: false }))
        .create((set) => ({
          count: 0,
          label: 'counter',
          inc: () => {
            set(
              (state) => {
                state.count += 1
              },
              false,
              'counter/inc',
            )
          },
          setLabel: (label) => {
            set({ label }, false, 'counter/setLabel')
          },
        })),
    )

    expectTypeOf(store.persist.hasHydrated()).toEqualTypeOf<boolean>()
    expectTypeOf<typeof store.devtools.cleanup>().toEqualTypeOf<() => void>()

    const observed: Array<readonly [number, number]> = []
    const unsubscribe = store.subscribe(
      (state) => state.count,
      (count, previousCount) => {
        observed.push([count, previousCount])
      },
    )

    store.getState().inc()
    store.setState({ count: 2 }, false, 'counter/setCount')

    expect(store.getState().count).toBe(2)
    expect(observed).toEqual([
      [1, 0],
      [2, 1],
    ])
    expect(store.persist.hasHydrated()).toBe(true)

    unsubscribe()
  })

  it('preserves use order with later middleware wrapping earlier middleware', () => {
    const events: string[] = []

    const store = createStore<{ count: number }>()(
      pipe
        .use(createOrderMarkerMiddleware<{ count: number }>('inner', events))
        .use(createOrderMarkerMiddleware<{ count: number }>('outer', events))
        .create(() => ({ count: 0 })),
    )

    expect(store.getState().count).toBe(0)
    expect(events).toEqual([
      'outer:before',
      'inner:before',
      'inner:after',
      'outer:after',
    ])
  })

  it('models the recommended built-in middleware order at the type level', () => {
    expectTypeOf<
      PipeCanUseMiddleware<
        [DevtoolsMutator, SubscribeWithSelectorMutator, PersistMutator],
        [ImmerMutator]
      >
    >().toEqualTypeOf<false>()
    expectTypeOf<
      PipeCanUseMiddleware<[PersistMutator], [DevtoolsMutator]>
    >().toEqualTypeOf<true>()
  })

  it('allows pipe creators without immer when the stack omits immer', () => {
    const baseCreator = definePipeStateCreator<
      CounterState,
      'persist' | 'subscribeWithSelector' | 'devtools'
    >((set) => ({
      count: 0,
      label: 'counter',
      inc: () => {
        set(
          (state) => ({ count: state.count + 1 }),
          false,
          'counter/inc',
        )
      },
      setLabel: (label) => {
        set({ label }, false, 'counter/setLabel')
      },
    }))

    expectTypeOf(baseCreator).toEqualTypeOf<
      StateCreator<
        CounterState,
        PipeMiddlewareStack<'persist' | 'subscribeWithSelector' | 'devtools'>,
        [],
        CounterState
      >
    >()

    const store = createStore<CounterState>()(
      pipe(
        baseCreator,
        persist<CounterState, PersistedCounterState>({
          name: 'counter-without-immer',
          storage: createJSONStorage<PersistedCounterState>(() =>
            createMemoryStorage(),
          ),
          partialize: (state) => ({ count: state.count }),
        }),
        subscribeWithSelector(),
        devtools({ name: 'CounterStoreWithoutImmer', enabled: false }),
      ),
    )

    store.getState().inc()
    store.setState({ count: 2 }, false, 'counter/setCount')

    expect(store.getState().count).toBe(2)
    expect(store.persist.hasHydrated()).toBe(true)
  })
})
