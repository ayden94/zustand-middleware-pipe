import { describe, expect, expectTypeOf, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { createJSONStorage as officialCreateJSONStorage } from 'zustand/middleware'
import * as publicApi from '../src/index'
import {
  definePipeableMiddleware,
  pipe,
  type DevtoolsMutator,
  type ImmerMutator,
  type PersistMutator,
  type Pipe,
  type PipeableMiddlewareMetadata,
  type PipeMiddleware,
  type SubscribeWithSelectorMutator,
} from '../src/index'
import type { PipeCanUseMiddleware } from '../src/types'
import * as middleware from '../src/middleware'
import { immer } from '../src/middleware/immer'
import { temporal } from '../src/middleware/zundo'
import {
  combine,
  createJSONStorage,
  devtools,
  persist,
  redux,
  subscribeWithSelector,
  type StateStorage,
} from '../src/middleware'

declare module 'zustand/vanilla' {
  interface StoreMutators<S, A> {
    'zustand-pipe/userland': S
  }
}

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

type SubscribeCounterState = {
  count: number
  label: string
  inc: () => void
}

type PersistHydrationEvent = {
  count: number
  label: string
}

type UserlandMutator = ['zustand-pipe/userland', never]

type MemoryStorageFixture = StateStorage & {
  getRawItem: (name: string) => string | undefined
}

type DevtoolsConnectionMock = {
  init: (state: unknown) => void
  send: (action: unknown, state: unknown) => void
  subscribe: (listener: (message: unknown) => void) => void
  unsubscribe: () => void
}

type WindowWithReduxDevtools = {
  __REDUX_DEVTOOLS_EXTENSION__?: {
    connect: (options: unknown) => DevtoolsConnectionMock
  }
}

function createMemoryStorage(
  seededValues: Record<string, string> = {},
): MemoryStorageFixture {
  const values = new Map(Object.entries(seededValues))

  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value)
    },
    removeItem: (name) => {
      values.delete(name)
    },
    getRawItem: (name) => values.get(name),
  }
}

function createUnavailableStorage(): StateStorage {
  const error = new Error('storage unavailable')

  return {
    getItem: () => {
      throw error
    },
    setItem: () => {
      throw error
    },
    removeItem: () => {
      throw error
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

function createPipeableOrderMarkerMiddleware<T>(
  name: string,
  events: string[],
  metadata: PipeableMiddlewareMetadata,
): PipeMiddleware<T, [], []> {
  return definePipeableMiddleware(
    createOrderMarkerMiddleware<T>(name, events),
    metadata,
  )
}

function captureUseError(builder: unknown, middleware: unknown): unknown {
  const typeBypassedBuilder = builder as {
    use: (middleware: unknown) => unknown
  }

  try {
    typeBypassedBuilder.use(middleware)
  } catch (error) {
    return error
  }

  return undefined
}

function createCombinedCounterStore() {
  return createStore<CounterState>()(
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
}

function createCombinedCounterStoreWithSelector() {
  return createStore<CounterState>()(
    pipe
      .use(devtools({ name: 'CombinedCounterStoreWithSelector', enabled: false }))
      .use(subscribeWithSelector())
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
}

function createReduxCounterStore() {
  const reducer = (
    state: Pick<CounterState, 'count'>,
    action: CounterAction,
  ) => {
    if (action.type === 'inc') {
      return { count: state.count + 1 }
    }

    return state
  }

  return createStore<ReduxCounterStore>()(
    pipe
      .use(devtools({ name: 'ReduxCounterStore', enabled: false }))
      .create(redux(reducer, { count: 0 })),
  )
}

function createReduxCounterStoreWithSelector() {
  const reducer = (
    state: Pick<CounterState, 'count'>,
    action: CounterAction,
  ) => {
    if (action.type === 'inc') {
      return { count: state.count + 1 }
    }

    return state
  }

  return createStore<ReduxCounterStore>()(
    pipe
      .use(devtools({ name: 'ReduxCounterStoreWithSelector', enabled: false }))
      .use(subscribeWithSelector())
      .create(redux(reducer, { count: 0 })),
  )
}

function createSubscribeWithSelectorCounterStore() {
  return createStore<SubscribeCounterState>()(
    pipe.use(subscribeWithSelector()).create((set) => ({
      count: 0,
      label: 'counter',
      inc: () => {
        set((state) => ({ count: state.count + 1 }))
      },
    })),
  )
}

function assertInvalidBuiltInStacksAtCompileTime() {
  // Compile-only regressions: TypeScript must reject invalid built-in stacks.
  void pipe
    .use(
      persist<CounterState, PersistedCounterState>({
        name: 'counter-order-regression',
        storage: createJSONStorage<PersistedCounterState>(() =>
          createMemoryStorage(),
        ),
        partialize: (state) => ({ count: state.count }),
      }),
    )
    // @ts-expect-error built-ins must be added outer-to-inner
    .use(devtools({ name: 'CounterOrderRegression', enabled: false }))

  void pipe
    .use(devtools({ name: 'CounterDuplicateRegression', enabled: false }))
    .use(
      // @ts-expect-error built-in middleware cannot be repeated in the stack
      devtools({
        name: 'CounterDuplicateRegressionAgain',
        enabled: false,
      }),
    )
}

void assertInvalidBuiltInStacksAtCompileTime

describe('pipe', () => {
  it('clears persisted data without replacing the live state', () => {
    // Given a real piped store writing a non-default persistence version.
    const storage = createMemoryStorage()
    const store = createStore<PersistedCounterState>()(
      pipe
        .use(persist<PersistedCounterState>({
          name: 'counter-clear-storage',
          storage: createJSONStorage<PersistedCounterState>(() => storage),
          version: 3,
          skipHydration: true,
        }))
        .create(() => ({ count: 0 })),
    )
    store.setState({ count: 4 })
    expect(storage.getRawItem('counter-clear-storage')).toBe(
      '{"state":{"count":4},"version":3}',
    )

    // When the public persistence extension clears its storage.
    store.persist.clearStorage()

    // Then the stored payload is removed while the current state is preserved.
    expect(storage.getRawItem('counter-clear-storage')).toBeUndefined()
    expect(store.getState().count).toBe(4)
  })

  it('persists only the partialized state through pipe and createJSONStorage', () => {
    const storage = createMemoryStorage()
    const store = createStore<CounterState>()(
      pipe
        .use(persist<CounterState, PersistedCounterState>({
          name: 'counter-partialize-through-pipe',
          storage: createJSONStorage<PersistedCounterState>(() => storage),
          partialize: (state) => ({ count: state.count }),
          skipHydration: true,
        }))
        .create((set) => ({
          count: 0,
          label: 'counter',
          inc: () => {
            set((state) => ({ count: state.count + 1 }))
          },
          setLabel: (label) => {
            set({ label })
          },
        })),
    )

    expect(storage.getRawItem('counter-partialize-through-pipe')).toBeUndefined()

    store.getState().setLabel('ignored label')

    expect(storage.getRawItem('counter-partialize-through-pipe')).toBe(
      '{"state":{"count":0},"version":0}',
    )

    store.getState().inc()

    expect(storage.getRawItem('counter-partialize-through-pipe')).toBe(
      '{"state":{"count":1},"version":0}',
    )
    expect(storage.getRawItem('counter-partialize-through-pipe')).not.toContain(
      'ignored label',
    )
  })

  it('hydrates seeded JSON explicitly through pipe rehydrate', async () => {
    const storage = createMemoryStorage({
      'counter-explicit-rehydrate': '{"state":{"count":7},"version":3}',
    })
    const hydrationEvents: PersistHydrationEvent[] = []
    const store = createStore<CounterState>()(
      pipe
        .use(persist<CounterState, PersistedCounterState>({
          name: 'counter-explicit-rehydrate',
          version: 3,
          storage: createJSONStorage<PersistedCounterState>(() => storage),
          partialize: (state) => ({ count: state.count }),
          skipHydration: true,
        }))
        .create((set) => ({
          count: 0,
          label: 'counter',
          inc: () => {
            set((state) => ({ count: state.count + 1 }))
          },
          setLabel: (label) => {
            set({ label })
          },
        })),
    )

    store.persist.onFinishHydration((state) => {
      hydrationEvents.push({ count: state.count, label: state.label })
    })

    expect(store.persist.hasHydrated()).toBe(false)
    expect(store.getState().count).toBe(0)

    await store.persist.rehydrate()

    expect(store.persist.hasHydrated()).toBe(true)
    expect(store.getState().count).toBe(7)
    expect(store.getState().label).toBe('counter')
    expect(hydrationEvents).toEqual([{ count: 7, label: 'counter' }])
  })

  it('handles throwing storage rehydrate through pipe without uncaught crashes', async () => {
    const storage = createJSONStorage<PersistedCounterState>(() =>
      createUnavailableStorage(),
    )
    const rehydrateErrors: unknown[] = []
    const store = createStore<CounterState>()(
      pipe
        .use(persist<CounterState, PersistedCounterState>({
          name: 'counter-unavailable-through-pipe',
          storage,
          partialize: (state) => ({ count: state.count }),
          skipHydration: true,
          onRehydrateStorage: () => (_state, error) => {
            rehydrateErrors.push(error)
          },
        }))
        .create((set) => ({
          count: 0,
          label: 'counter',
          inc: () => {
            set((state) => ({ count: state.count + 1 }))
          },
          setLabel: (label) => {
            set({ label })
          },
        })),
    )

    await expect(store.persist.rehydrate()).resolves.toBeUndefined()

    expect(store.persist.hasHydrated()).toBe(false)
    expect(store.getState().count).toBe(0)
    expect(rehydrateErrors).toHaveLength(1)
    expect(rehydrateErrors[0]).toBeInstanceOf(Error)
  })

  it('exports the intended root runtime helpers', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'definePipeableMiddleware',
      'pipe',
    ])
    expect(typeof definePipeableMiddleware).toBe('function')
    expect(Object.keys(pipe).sort()).toEqual([
      'use',
    ])
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
    expect('temporal' in middleware).toBe(false)
    expect(typeof middleware.combine).toBe('function')
    expect(typeof middleware.createJSONStorage).toBe('function')
    expect(middleware.createJSONStorage).toBe(officialCreateJSONStorage)
    expect(typeof middleware.persist).toBe('function')
    expect(typeof middleware.redux).toBe('function')
    expect(typeof middleware.subscribeWithSelector).toBe('function')
    expect(typeof middleware.devtools).toBe('function')
    expect(typeof middleware.definePipeableMiddleware).toBe('function')
  })

  it('exports Immer from the dedicated middleware subpath', () => {
    expect(typeof immer).toBe('function')
  })

  it('exports zundo temporal from the dedicated middleware subpath', () => {
    expect(typeof temporal).toBe('function')
  })

  it('builds a Zustand middleware stack while preserving store extensions', () => {
    const storage = createMemoryStorage()
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'window',
    )
    const cleanupEvents: string[] = []
    const windowMock: WindowWithReduxDevtools = {
      __REDUX_DEVTOOLS_EXTENSION__: {
        connect: () => ({
          init: () => {},
          send: () => {},
          subscribe: () => {},
          unsubscribe: () => {
            cleanupEvents.push('cleanup')
          },
        }),
      },
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: windowMock,
    })

    try {
      const store = createStore<CounterState>()(
        pipe
          .use(devtools({ name: 'CounterStore' }))
          .use(subscribeWithSelector())
          .use(persist<CounterState, PersistedCounterState>({
            name: 'counter',
            storage: createJSONStorage<PersistedCounterState>(() => storage),
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
      expect(store.persist.hasHydrated()).toBe(true)
      expect(typeof store.devtools.cleanup).toBe('function')

      const observed: Array<readonly [number, number]> = []
      const unsubscribe = store.subscribe(
        (state) => state.count,
        (count, previousCount) => {
          observed.push([count, previousCount])
        },
      )

      store.getState().inc()
      expect(store.getState().count).toBe(1)
      expect(storage.getRawItem('counter')).toBe(
        '{"state":{"count":1},"version":0}',
      )

      store.setState({ count: 2 }, false, 'counter/setCount')

      expect(store.getState().count).toBe(2)
      expect(observed).toEqual([
        [1, 0],
        [2, 1],
      ])
      expect(storage.getRawItem('counter')).toBe(
        '{"state":{"count":2},"version":0}',
      )

      unsubscribe()
      store.devtools.cleanup()
      expect(cleanupEvents).toEqual(['cleanup'])
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
      } else {
        delete (globalThis as { window?: unknown }).window
      }
    }
  })

  it('supports official combine as a terminal state creator helper', () => {
    const store = createCombinedCounterStore()

    store.getState().inc()

    expect(store.getState().count).toBe(1)
    expectTypeOf<typeof store.devtools.cleanup>().toEqualTypeOf<() => void>()
  })

  it('supports official combine as a terminal state creator helper under subscribeWithSelector', () => {
    const store = createCombinedCounterStoreWithSelector()

    const observed: Array<readonly [number, number]> = []
    const unsubscribe = store.subscribe(
      (state) => state.count,
      (count, previousCount) => {
        observed.push([count, previousCount])
      },
    )

    store.getState().setLabel('renamed')
    store.getState().inc()
    store.setState({ count: 2, label: 'final' })

    expect(store.getState()).toEqual({
      count: 2,
      label: 'final',
      inc: expect.any(Function),
      setLabel: expect.any(Function),
    })
    expect(observed).toEqual([
      [1, 0],
      [2, 1],
    ])
    expectTypeOf<typeof store.devtools.cleanup>().toEqualTypeOf<() => void>()

    unsubscribe()
  })

  it('supports official redux as a terminal state creator helper', () => {
    const store = createReduxCounterStore()

    store.dispatch({ type: 'inc' })

    expect(store.getState().count).toBe(1)
    expectTypeOf(store.dispatch).toEqualTypeOf<
      (action: CounterAction) => CounterAction
    >()
    expectTypeOf<typeof store.devtools.cleanup>().toEqualTypeOf<() => void>()
  })

  it('supports official redux as a terminal state creator helper under subscribeWithSelector', () => {
    const store = createReduxCounterStoreWithSelector()

    const observed: Array<readonly [number, number]> = []
    const unsubscribe = store.subscribe(
      (state) => state.count,
      (count, previousCount) => {
        observed.push([count, previousCount])
      },
    )

    const dispatched = store.dispatch({ type: 'inc' })
    store.setState({ count: 2 })

    expect(dispatched).toEqual({ type: 'inc' })
    expect(store.getState().count).toBe(2)
    expect(observed).toEqual([
      [1, 0],
      [2, 1],
    ])
    expectTypeOf(store.dispatch).toEqualTypeOf<
      (action: CounterAction) => CounterAction
    >()
    expectTypeOf<typeof store.devtools.cleanup>().toEqualTypeOf<() => void>()

    unsubscribe()
  })

  it('keeps selector and plain subscribe behavior with subscribeWithSelector', () => {
    const store = createSubscribeWithSelectorCounterStore()

    const selectedObserved: Array<readonly [number, number]> = []
    const unsubscribeSelected = store.subscribe(
      (state) => state.count,
      (count, previousCount) => {
        selectedObserved.push([count, previousCount])
      },
    )

    const plainObserved: SubscribeCounterState[] = []
    const unsubscribePlain = store.subscribe((state) => {
      plainObserved.push(state)
    })

    store.getState().inc()
    store.setState({ count: 2, label: 'second' })

    expect(selectedObserved).toEqual([
      [1, 0],
      [2, 1],
    ])
    expect(plainObserved).toEqual([
      expect.objectContaining({ count: 1, label: 'counter' }),
      expect.objectContaining({ count: 2, label: 'second' }),
    ])

    unsubscribeSelected()
    unsubscribePlain()
  })

  it('suppresses equivalent selected values with equalityFn', () => {
    const store = createSubscribeWithSelectorCounterStore()

    const selectedObserved: Array<readonly [number, number]> = []
    const unsubscribe = store.subscribe(
      (state) => state.count,
      (count, previousCount) => {
        selectedObserved.push([count, previousCount])
      },
      {
        equalityFn: (countA, countB) => countA % 2 === countB % 2,
      },
    )

    store.getState().inc()
    store.setState({ count: 3, label: 'third' })
    store.setState({ count: 4, label: 'fourth' })

    expect(selectedObserved).toEqual([
      [1, 0],
      [4, 1],
    ])

    unsubscribe()
  })

  it('fires immediately with the initial selected value', () => {
    const store = createSubscribeWithSelectorCounterStore()

    const selectedObserved: Array<readonly [number, number]> = []
    const unsubscribe = store.subscribe(
      (state) => state.count,
      (count, previousCount) => {
        selectedObserved.push([count, previousCount])
      },
      { fireImmediately: true },
    )

    store.getState().inc()
    store.setState({ count: 2, label: 'second' })

    expect(selectedObserved).toEqual([
      [0, 0],
      [1, 0],
      [2, 1],
    ])

    unsubscribe()
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

  it('allows repeated untagged middleware at runtime', () => {
    const events: string[] = []
    const marker = createOrderMarkerMiddleware<{ count: number }>(
      'marker',
      events,
    )

    const store = createStore<{ count: number }>()(
      pipe.use(marker).use(marker).create(() => ({ count: 0 })),
    )

    expect(store.getState().count).toBe(0)
    expect(events).toEqual([
      'marker:before',
      'marker:before',
      'marker:after',
      'marker:after',
    ])
  })

  it('composes the optional zundo temporal middleware subpath', () => {
    const store = createStore<Pick<CounterState, 'count' | 'inc'>>()(
      pipe
        .use(temporal<Pick<CounterState, 'count' | 'inc'>>())
        .create((set) => ({
          count: 0,
          inc: () => {
            set((state) => ({ count: state.count + 1 }))
          },
        })),
    )

    store.getState().inc()

    expect(store.getState().count).toBe(1)
    expect(typeof store.temporal.getState().undo).toBe('function')
    expect(store.temporal.getState().pastStates[0]?.count).toBe(0)

    store.temporal.getState().undo()

    expect(store.getState().count).toBe(0)
    expect(store.temporal.getState().futureStates[0]?.count).toBe(1)
  })

  it('honors pipeable middleware order metadata for tagged userland middleware', () => {
    const events: string[] = []
    const outer = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'outer',
      events,
      {
        id: 'test/outer',
        order: { before: ['test/inner'] },
      },
    )
    const inner = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'inner',
      events,
      {
        id: 'test/inner',
        order: { after: ['test/outer'] },
      },
    )

    const store = createStore<{ count: number }>()(
      pipe.use(outer).use(inner).create(() => ({ count: 0 })),
    )

    expect(store.getState().count).toBe(0)
    expect(events).toEqual([
      'outer:before',
      'inner:before',
      'inner:after',
      'outer:after',
    ])
  })

  it('ignores pipeable order targets that are not present in the chain', () => {
    const events: string[] = []
    const marker = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'marker',
      events,
      {
        id: 'test/missing-target-marker',
        order: {
          after: ['test/not-present-before'],
          before: ['test/not-present-after'],
        },
      },
    )

    const store = createStore<{ count: number }>()(
      pipe.use(marker).create(() => ({ count: 0 })),
    )

    expect(store.getState().count).toBe(0)
    expect(events).toEqual(['marker:before', 'marker:after'])
  })

  it('rejects duplicate pipeable middleware ids unless explicitly allowed', () => {
    const first = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'first',
      [],
      { id: 'test/duplicate' },
    )
    const second = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'second',
      [],
      { id: 'test/duplicate' },
    )
    const thrown = captureUseError(pipe.use(first), second)

    expect(thrown).toBeInstanceOf(TypeError)

    if (!(thrown instanceof Error)) {
      throw new Error('Expected duplicate pipeable middleware to throw')
    }

    expect(thrown.message).toContain('test/duplicate')
    expect(thrown.message).toContain('cannot be added more than once')
  })

  it.each([
    ['reject', 'allow'],
    ['allow', 'reject'],
  ] as const)(
    'rejects conflicting duplicate policies (%s then %s)',
    (firstPolicy, secondPolicy) => {
      // Given the same id with conflicting explicit policies.
      const first = createPipeableOrderMarkerMiddleware<{ count: number }>(
        'first',
        [],
        { id: 'test/conflicting-duplicate', duplicate: firstPolicy },
      )
      const second = createPipeableOrderMarkerMiddleware<{ count: number }>(
        'second',
        [],
        { id: 'test/conflicting-duplicate', duplicate: secondPolicy },
      )
      const builder = pipe.use(first)

      // When either ordering attempts to add the second instance.
      const addDuplicate = () => builder.use(second)

      // Then either instance's reject policy is respected.
      expect(addDuplicate).toThrow(TypeError)
    },
  )

  it('preserves a reusable allow-policy builder after a rejected branch', () => {
    // Given an allow-policy base and a conflicting branch.
    const events: string[] = []
    const repeatable = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'repeatable',
      events,
      { id: 'test/reusable-duplicate', duplicate: 'allow' },
    )
    const rejecting = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'rejecting',
      events,
      { id: 'test/reusable-duplicate', duplicate: 'reject' },
    )
    const builder = pipe.use(repeatable)
    expect(() => builder.use(rejecting)).toThrow(TypeError)

    // When the original builder is reused for a valid repeated middleware.
    const store = createStore<{ count: number }>()(
      builder.use(repeatable).create(() => ({ count: 0 })),
    )

    // Then the failed branch has not changed the accepted middleware chain.
    expect(store.getState().count).toBe(0)
    expect(events).toEqual([
      'repeatable:before',
      'repeatable:before',
      'repeatable:after',
      'repeatable:after',
    ])
  })

  it('allows duplicate pipeable middleware ids with duplicate allow policy', () => {
    const events: string[] = []
    const first = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'first',
      events,
      { id: 'test/repeatable', duplicate: 'allow' },
    )
    const second = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'second',
      events,
      { id: 'test/repeatable', duplicate: 'allow' },
    )

    const store = createStore<{ count: number }>()(
      pipe.use(first).use(second).create(() => ({ count: 0 })),
    )

    expect(store.getState().count).toBe(0)
    expect(events).toEqual([
      'first:before',
      'second:before',
      'second:after',
      'first:after',
    ])
  })

  it('rejects pipeable middleware order violations at .use(...) time', () => {
    const outer = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'outer',
      [],
      { id: 'test/order-outer' },
    )
    const inner = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'inner',
      [],
      {
        id: 'test/order-inner',
        order: { after: ['test/order-outer'] },
      },
    )
    const thrown = captureUseError(pipe.use(inner), outer)

    expect(thrown).toBeInstanceOf(TypeError)

    if (!(thrown instanceof Error)) {
      throw new Error('Expected pipeable order violation to throw')
    }

    expect(thrown.message).toContain('test/order-outer')
    expect(thrown.message).toContain('test/order-inner')
    expect(thrown.message).toContain('must be added before')
  })

  it('rejects cyclic pipeable middleware order metadata', () => {
    const first = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'first',
      [],
      {
        id: 'test/cycle-first',
        order: { after: ['test/cycle-second'] },
      },
    )
    const second = createPipeableOrderMarkerMiddleware<{ count: number }>(
      'second',
      [],
      {
        id: 'test/cycle-second',
        order: { after: ['test/cycle-first'] },
      },
    )
    const thrown = captureUseError(pipe.use(first), second)

    expect(thrown).toBeInstanceOf(TypeError)

    if (!(thrown instanceof Error)) {
      throw new Error('Expected pipeable cycle to throw')
    }

    expect(thrown.message).toContain('cycle')
    expect(thrown.message).toContain('test/cycle-first')
    expect(thrown.message).toContain('test/cycle-second')
  })

  it('rejects public pipeable metadata that conflicts with reserved built-in ids', () => {
    const marker = createOrderMarkerMiddleware<{ count: number }>('marker', [])

    expect(() =>
      definePipeableMiddleware(marker, { id: 'zustand/persist' }),
    ).toThrow('reserved built-in id')
  })

  it('rejects package built-in wrong order at .use(...) time', () => {
    const builder = pipe.use(
      persist<CounterState, PersistedCounterState>({
        name: 'counter-runtime-order-regression',
        storage: createJSONStorage<PersistedCounterState>(() =>
          createMemoryStorage(),
        ),
        partialize: (state) => ({ count: state.count }),
      }),
    )
    const typeBypassedBuilder = builder as unknown as {
      use: (middleware: unknown) => unknown
    }
    let thrown: unknown

    try {
      typeBypassedBuilder.use(
        devtools({
          name: 'CounterRuntimeOrderRegression',
          enabled: false,
        }),
      )
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(TypeError)

    if (!(thrown instanceof Error)) {
      throw new Error('Expected .use(...) to throw an Error instance')
    }

    expect(thrown.message).toContain(
      'devtools, subscribeWithSelector, persist, immer',
    )
  })

  it('rejects duplicate package built-ins at .use(...) time', () => {
    const duplicateCases: Array<{
      kind: string
      builder: unknown
      duplicate: unknown
    }> = [
      {
        kind: 'devtools',
        builder: pipe.use(
          devtools({ name: 'CounterRuntimeDuplicateDevtools', enabled: false }),
        ),
        duplicate: devtools({
          name: 'CounterRuntimeDuplicateDevtoolsAgain',
          enabled: false,
        }),
      },
      {
        kind: 'subscribeWithSelector',
        builder: pipe.use(subscribeWithSelector()),
        duplicate: subscribeWithSelector(),
      },
      {
        kind: 'persist',
        builder: pipe.use(
          persist<CounterState, PersistedCounterState>({
            name: 'counter-runtime-duplicate-persist',
            storage: createJSONStorage<PersistedCounterState>(() =>
              createMemoryStorage(),
            ),
            partialize: (state) => ({ count: state.count }),
          }),
        ),
        duplicate: persist<CounterState, PersistedCounterState>({
          name: 'counter-runtime-duplicate-persist-again',
          storage: createJSONStorage<PersistedCounterState>(() =>
            createMemoryStorage(),
          ),
          partialize: (state) => ({ count: state.count }),
        }),
      },
      {
        kind: 'immer',
        builder: pipe.use(immer()),
        duplicate: immer(),
      },
    ]

    for (const { kind, builder, duplicate } of duplicateCases) {
      const thrown = captureUseError(builder, duplicate)

      expect(thrown).toBeInstanceOf(TypeError)

      if (!(thrown instanceof Error)) {
        throw new Error(`Expected duplicate ${kind} to throw an Error instance`)
      }

      expect(thrown.message).toContain(kind)
      expect(thrown.message).toContain('cannot be added more than once')
    }
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
    expectTypeOf<
      PipeCanUseMiddleware<[], [DevtoolsMutator, PersistMutator]>
    >().toEqualTypeOf<true>()
    expectTypeOf<
      PipeCanUseMiddleware<[PersistMutator], [ImmerMutator]>
    >().toEqualTypeOf<true>()
  })

  it('rejects duplicate package built-in mutators at the type level', () => {
    expectTypeOf<
      PipeCanUseMiddleware<[DevtoolsMutator], [DevtoolsMutator]>
    >().toEqualTypeOf<false>()
    expectTypeOf<
      PipeCanUseMiddleware<
        [SubscribeWithSelectorMutator],
        [SubscribeWithSelectorMutator]
      >
    >().toEqualTypeOf<false>()
    expectTypeOf<
      PipeCanUseMiddleware<[PersistMutator], [PersistMutator]>
    >().toEqualTypeOf<false>()
    expectTypeOf<
      PipeCanUseMiddleware<[ImmerMutator], [ImmerMutator]>
    >().toEqualTypeOf<false>()
    expectTypeOf<
      PipeCanUseMiddleware<[], [DevtoolsMutator, DevtoolsMutator]>
    >().toEqualTypeOf<false>()
  })

  it('does not reject repeated non-built-in mutators at the type level', () => {
    expectTypeOf<
      PipeCanUseMiddleware<[UserlandMutator], [UserlandMutator]>
    >().toEqualTypeOf<true>()
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
