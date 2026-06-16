import { create, useStore, type UseBoundStore } from 'zustand'
import type { StateCreator, StoreApi } from 'zustand/vanilla'
import { pipe } from 'zustand-middleware-pipe'
import { createJSONStorage, persist } from 'zustand-middleware-pipe/middleware'
import {
  temporal,
  type TemporalState,
} from 'zustand-middleware-pipe/middleware/zundo'

export interface TemporalCounterState {
  count: number
  decrement: () => void
  increment: () => void
  reset: () => void
}

const initialState = { count: 0 }

type TemporalCounterStore = UseBoundStore<
  StoreApi<TemporalCounterState> & {
    readonly temporal: StoreApi<TemporalState<TemporalCounterState>>
  }
>

const pipeForTemporalExample = pipe as unknown as {
  use: (middleware: unknown) => {
    create: (
      initializer: StateCreator<TemporalCounterState, [], []>,
    ) => StateCreator<TemporalCounterState, [], []>
  }
}

type TemporalHistoryState = TemporalState<TemporalCounterState>

const persistTemporalHistory = (
  temporalCreator: StateCreator<TemporalHistoryState>,
) =>
  pipe
    .use(
      persist<TemporalHistoryState, Pick<TemporalHistoryState, 'futureStates' | 'pastStates'>>({
        name: 'zustand-middleware-pipe-zundo-history',
        storage: createJSONStorage<Pick<TemporalHistoryState, 'futureStates' | 'pastStates'>>(
          () => localStorage,
        ),
        partialize: (state) => ({
          futureStates: state.futureStates,
          pastStates: state.pastStates,
        }),
      }),
    )
    .create(temporalCreator)

const temporalCounterCreator = pipeForTemporalExample
  .use(
    temporal<TemporalCounterState>({
      limit: 12,
      wrapTemporal: (temporalCreator) =>
        persistTemporalHistory(
          temporalCreator as unknown as StateCreator<TemporalHistoryState>,
        ) as unknown as typeof temporalCreator,
    }),
  )
  .create((set) => ({
    ...initialState,
    decrement: () => {
      set((state) => ({ count: state.count - 1 }))
    },
    increment: () => {
      set((state) => ({ count: state.count + 1 }))
    },
    reset: () => {
      set(initialState)
    },
  })) as unknown as StateCreator<TemporalCounterState, [], []>

export const useTemporalCounterStore = create<TemporalCounterState>()(
  temporalCounterCreator,
) as TemporalCounterStore

export function useTemporalHistoryDepth() {
  const pastDepth = useStore(
    useTemporalCounterStore.temporal,
    (state) => state.pastStates.length,
  )
  const futureDepth = useStore(
    useTemporalCounterStore.temporal,
    (state) => state.futureStates.length,
  )

  return { futureDepth, pastDepth }
}
