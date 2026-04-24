import { create } from 'zustand'
import {
  definePipeStateCreator,
  pipe,
  withDevtools,
  withImmer,
  withPersist,
  withSubscribeWithSelector,
} from 'zustand-middleware-pipe'
import { createJSONStorage } from 'zustand/middleware'

export interface CounterState {
  count: number
  label: string
  decrement: () => void
  increment: () => void
  reset: () => void
  setLabel: (label: string) => void
}

type PersistedCounterState = Pick<CounterState, 'count' | 'label'>

const initialState = {
  count: 0,
  label: 'middleware pipe demo',
} satisfies PersistedCounterState

const baseCreator = definePipeStateCreator<
  CounterState,
  'immer' | 'persist' | 'subscribeWithSelector' | 'devtools'
>((set) => ({
  ...initialState,
  decrement: () => {
    set(
      (state) => {
        state.count -= 1
      },
      false,
      'counter/decrement',
    )
  },
  increment: () => {
    set(
      (state) => {
        state.count += 1
      },
      false,
      'counter/increment',
    )
  },
  reset: () => {
    set(initialState, false, 'counter/reset')
  },
  setLabel: (label) => {
    set({ label }, false, 'counter/setLabel')
  },
}))

export const useCounterStore = create<CounterState>()(
  pipe(
    baseCreator,
    withImmer(),
    withPersist<CounterState, PersistedCounterState>({
      name: 'zustand-middleware-pipe-demo',
      storage: createJSONStorage<PersistedCounterState>(() => localStorage),
      partialize: (state) => ({ count: state.count, label: state.label }),
    }),
    withSubscribeWithSelector(),
    withDevtools({ name: 'ZustandMiddlewarePipeDemo' }),
  ),
)
