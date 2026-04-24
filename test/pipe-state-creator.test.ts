import { describe, expect, expectTypeOf, it } from 'vitest'
import { createJSONStorage, type StateStorage } from 'zustand/middleware'
import { createStore, type StateCreator } from 'zustand/vanilla'
import {
  pipe,
  pipeStateCreator,
  withDevtools,
  withImmer,
  withPersist,
  withSubscribeWithSelector,
} from '../src/index.js'

interface CounterState {
  count: number
  label: string
  inc: () => void
  setLabel: (label: string) => void
}

type PersistedCounterState = Pick<CounterState, 'count'>

type CounterMiddlewareStack = [
  ['zustand/devtools', never],
  ['zustand/subscribeWithSelector', never],
  ['zustand/persist', unknown],
  ['zustand/immer', never],
]

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

  it('composes Zustand middleware wrappers while preserving store extensions', () => {
    const baseCreator: StateCreator<
      CounterState,
      CounterMiddlewareStack,
      [],
      CounterState
    > = (set) => ({
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
    })

    const store = createStore<CounterState>()(
      pipe(
        baseCreator,
        withImmer(),
        withPersist<CounterState, PersistedCounterState>({
          name: 'counter',
          storage: createJSONStorage<PersistedCounterState>(() =>
            createMemoryStorage(),
          ),
          partialize: (state) => ({ count: state.count }),
        }),
        withSubscribeWithSelector(),
        withDevtools({ name: 'CounterStore', enabled: false }),
      ),
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
})
