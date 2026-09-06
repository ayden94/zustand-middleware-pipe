import { temporal as zundoTemporal } from 'zundo'
import type { TemporalState, Zundo, ZundoOptions } from 'zundo'
import type {} from 'zundo'
import type { StateCreator, StoreApi } from 'zustand/vanilla'
import { defineUserlandPipeableMiddleware } from '../middleware-metadata.js'
import type { MutatorTuple, PipeMiddleware } from '../types.js'

type ZundoInputMutator = ['temporal', unknown]
type ZundoProducedMutator<UState> = [
  'temporal',
  StoreApi<TemporalState<UState>>,
]

/** @deprecated Supply temporal<State>() for typed history. */
export function temporal<TState = unknown>(
  ..._untyped: unknown extends TState ? [] : [stateType: never]
): PipeMiddleware<TState, [], [ZundoProducedMutator<TState>]>
export function temporal<TState, UState = TState>(
  options?: ZundoOptions<TState, UState>,
): PipeMiddleware<TState, [], [ZundoProducedMutator<UState>]>
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
