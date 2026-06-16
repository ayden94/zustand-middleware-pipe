import { create } from 'zustand'
import { pipe } from 'zustand-middleware-pipe'
import { combine, devtools, subscribeWithSelector } from 'zustand-middleware-pipe/middleware'

export interface CombinedCounterState {
  count: number
  decrement: () => void
  increment: () => void
  reset: () => void
}

export const useCombinedCounterStore = create<CombinedCounterState>()(
  pipe    
    .use(devtools({ name: 'CombinedCounterExample', enabled: false }))
    .use(subscribeWithSelector())
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
