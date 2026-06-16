import { describe, expect, expectTypeOf, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import * as publicApi from '../src/index.js'
import {
  pipe,
  type DevtoolsMutator,
  type ImmerMutator,
  type PersistMutator,
  type Pipe,
  type PipeMiddleware,
  type SubscribeWithSelectorMutator,
} from '../src/index.js'
import type { PipeCanUseMiddleware } from '../src/types.js'
import * as middleware from '../src/middleware.js'
import { immer } from '../src/middleware/immer.js'
import {
  combine,
  createJSONStorage,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
  type StateStorage,
} from '../src/middleware.js'

interface CounterState {
  count: number
  label: string
  inc: () => void
  setLabel: (label: string) => void
}

type PersistedCounterState = Pick<CounterState, 'count'>

type CounterAction = { type: 'inc' }
type ReduxCounterStore = Pick<CounterState, 'count'> & {
  dispatch: (action: CounterAction) => CounterAction
}

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
  it('exports the intended root runtime helpers', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'pipe',
    ])
    expect(Object.keys(pipe).sort()).toEqual([
      'use',
    ])
    expect('definePipeStateCreator' in publicApi).toBe(false)
    expect('create' in pipe).toBe(false)
    expect('pipeStore' in publicApi).toBe(false)
    expect('pipeStateCreator' in publicApi).toBe(false)
    expectTypeOf(pipe).toEqualTypeOf<Pipe>()
  })

  it('starts a typed builder from pipe.use', () => {
    const builder = pipe
      .use(persist<CounterState, PersistedCounterState>({
        name: 'counter-builder',
        storage: createJSONStorage<PersistedCounterState>(() =>
          createMemoryStorage(),
        ),
        partialize: (state) => ({ count: state.count }),
      }))
      .use(immer())

    expect(typeof pipe.use).toBe('function')
    expect(typeof builder.use).toBe('function')
    expect(typeof builder.create).toBe('function')
  })

  it('exports non-Immer wrappers from the middleware barrel', () => {
    expect('immer' in middleware).toBe(false)
    expect(typeof middleware.combine).toBe('function')
    expect(typeof middleware.createJSONStorage).toBe('function')
    expect(typeof middleware.persist).toBe('function')
    expect(typeof middleware.redux).toBe('function')
    expect(typeof middleware.subscribeWithSelector).toBe('function')
    expect(typeof middleware.devtools).toBe('function')
  })

  it('exports Immer from the dedicated middleware subpath', () => {
    expect(typeof immer).toBe('function')
  })

  it('builds a Zustand middleware stack while preserving store extensions', () => {
    const store = createStore<CounterState>()(
      pipe
        .use(devtools({ name: 'CounterStore', enabled: false }))
        .use(subscribeWithSelector())
        .use(persist<CounterState, PersistedCounterState>({
          name: 'counter',
          storage: createJSONStorage<PersistedCounterState>(() =>
            createMemoryStorage(),
          ),
          partialize: (state) => ({ count: state.count }),
        }))
        .use(immer())
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

  it('supports official combine as a terminal state creator helper', () => {
    const store = createStore(
      pipe
        .use(devtools({ name: 'CombinedCounterStore', enabled: false }))
        .create<CounterState>(
          combine({ count: 0, label: 'counter' }, (set) => ({
            inc: () => {
              set((state) => ({ count: state.count + 1 }))
            },
            setLabel: (label: string) => {
              set({ label })
            },
          })),
        ),
    )

    store.getState().inc()

    expect(store.getState().count).toBe(1)
    expectTypeOf<typeof store.devtools.cleanup>().toEqualTypeOf<() => void>()
  })

  it('supports official redux as a terminal state creator helper', () => {
    const reducer = (
      state: Pick<CounterState, 'count'>,
      action: CounterAction,
    ) => {
      if (action.type === 'inc') {
        return { count: state.count + 1 }
      }

      return state
    }

    const store = createStore<ReduxCounterStore>()(
      pipe
        .use(devtools({ name: 'ReduxCounterStore', enabled: false }))
        .create(redux(reducer, { count: 0 })),
    )

    store.dispatch({ type: 'inc' })

    expect(store.getState().count).toBe(1)
    expectTypeOf(store.dispatch).toEqualTypeOf<
      (action: CounterAction) => CounterAction
    >()
    expectTypeOf<typeof store.devtools.cleanup>().toEqualTypeOf<() => void>()
  })

  it('preserves use order with earlier middleware wrapping later middleware', () => {
    const events: string[] = []

    const store = createStore<{ count: number }>()(
      pipe
        .use(createOrderMarkerMiddleware<{ count: number }>('outer', events))
        .use(createOrderMarkerMiddleware<{ count: number }>('inner', events))
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
    >().toEqualTypeOf<true>()
    expectTypeOf<
      PipeCanUseMiddleware<[PersistMutator], [DevtoolsMutator]>
    >().toEqualTypeOf<false>()
  })

  it('allows pipe creators without immer when the stack omits immer', () => {
    const store = createStore<CounterState>()(
      pipe
        .use(devtools({ name: 'CounterStoreWithoutImmer', enabled: false }))
        .use(subscribeWithSelector())
        .use(persist<CounterState, PersistedCounterState>({
          name: 'counter-without-immer',
          storage: createJSONStorage<PersistedCounterState>(() =>
            createMemoryStorage(),
          ),
          partialize: (state) => ({ count: state.count }),
        }))
        .create((set) => ({
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
        })),
    )

    store.getState().inc()
    store.setState({ count: 2 }, false, 'counter/setCount')

    expect(store.getState().count).toBe(2)
    expect(store.persist.hasHydrated()).toBe(true)
  })
})
