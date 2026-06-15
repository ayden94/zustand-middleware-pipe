import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'
import {
  devtools,
  persist,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
import { immer } from 'zustand-middleware-pipe/middleware/immer'
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

export const useCounterStore = create<CounterState>()(
  pipe<CounterState>()
    .use(immer())
    .use(persist<CounterState, PersistedCounterState>({
      name: 'zustand-middleware-pipe-demo',
      storage: createJSONStorage<PersistedCounterState>(() => localStorage),
      partialize: (state) => ({ count: state.count, label: state.label }),
    }))
    .use(subscribeWithSelector())
    .use(devtools({ name: 'ZustandMiddlewarePipeDemo' }))
    .create((set) => ({
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
    })),
)
