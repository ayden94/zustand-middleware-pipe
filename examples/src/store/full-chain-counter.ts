import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'
import {
  createJSONStorage,
  devtools,
  persist,
  subscribeWithSelector,
} from 'zustand-middleware-pipe/middleware'
import { immer } from 'zustand-middleware-pipe/middleware/immer'

export interface FullChainCounterState {
  count: number
  label: string
  decrement: () => void
  increment: () => void
  reset: () => void
  setLabel: (label: string) => void
}

type PersistedCounterState = Pick<FullChainCounterState, 'count' | 'label'>

const initialState = {
  count: 0,
  label: 'middleware pipe demo',
} satisfies PersistedCounterState

export const useFullChainCounterStore = create<FullChainCounterState>()(
  pipe
    .use(devtools({ name: 'ZustandMiddlewarePipeDemo' }))
    .use(subscribeWithSelector())
    .use(persist<FullChainCounterState, PersistedCounterState>({
      name: 'zustand-middleware-pipe-demo',
      storage: createJSONStorage<PersistedCounterState>(() => localStorage),
      partialize: (state) => ({ count: state.count, label: state.label }),
    }))
    .use(immer())
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
