import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'
import {
  combine,
  devtools,
  persist,
  redux,
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

export interface CombinedCounterState {
  count: number
  decrement: () => void
  increment: () => void
  reset: () => void
}

type ReduxCounterAction =
  | { type: 'decrement' }
  | { type: 'increment' }
  | { type: 'reset' }

interface ReduxCounterState {
  count: number
}

export type ReduxCounterStore = ReduxCounterState & {
  dispatch: (action: ReduxCounterAction) => ReduxCounterAction
}

const initialState = {
  count: 0,
  label: 'middleware pipe demo',
} satisfies PersistedCounterState

export const useCounterStore = create<CounterState>()(
  pipe.use(immer())
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

export const useCombinedCounterStore = create<CombinedCounterState>()(
  pipe
    .use(devtools({ name: 'CombinedCounterExample', enabled: false }))
    .create(
      combine({ count: 0 }, (set) => ({
        decrement: () => {
          set((state) => ({ count: state.count - 1 }))
        },
        increment: () => {
          set((state) => ({ count: state.count + 1 }))
        },
        reset: () => {
          set({ count: 0 })
        },
      })),
    ),
)

const reduxCounterReducer = (
  state: ReduxCounterState,
  action: ReduxCounterAction,
): ReduxCounterState => {
  switch (action.type) {
    case 'decrement':
      return { count: state.count - 1 }
    case 'increment':
      return { count: state.count + 1 }
    case 'reset':
      return { count: 0 }
  }
}

export const useReduxCounterStore = create<ReduxCounterStore>()(
  pipe
    .use(devtools({ name: 'ReduxCounterExample', enabled: false }))
    .create(redux(reduxCounterReducer, { count: 0 })),
)
