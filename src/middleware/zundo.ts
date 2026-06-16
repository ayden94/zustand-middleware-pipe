import { temporal as zundoTemporal } from 'zundo'
import type { TemporalState, Zundo, ZundoOptions } from 'zundo'
import type {} from 'zundo'
import type { StateCreator, StoreApi } from 'zustand/vanilla'
import { defineUserlandPipeableMiddleware } from '../middleware-metadata'
import type { MutatorTuple, PipeMiddleware } from '../types'

type ZundoInputMutator = ['temporal', unknown]
type ZundoProducedMutator<UState> = [
  'temporal',
  StoreApi<TemporalState<UState>>,
]

export function temporal<TState, UState = TState>(
  options?: ZundoOptions<TState, UState>,
): PipeMiddleware<
  TState,
  [],
  [ZundoProducedMutator<UState>]
> {
  return defineUserlandPipeableMiddleware(
    <Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
      initializer: StateCreator<TState, Mps, Mcs>,
    ) => {
      const zundoInitializer = initializer as unknown as StateCreator<
        TState,
        [...Mps, ZundoInputMutator],
        Mcs
      >

      return zundoTemporal<TState, Mps, Mcs, UState>(zundoInitializer, options)
    },
    { id: 'zundo/temporal' },
  )
}

export type { TemporalState, Zundo, ZundoOptions }
