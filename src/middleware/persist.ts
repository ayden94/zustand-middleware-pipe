import { persist as zustandPersist } from 'zustand/middleware'
import type { PersistOptions } from 'zustand/middleware'
import type { StateCreator } from 'zustand/vanilla'
import type {
  MutatorTuple,
  PersistMutator,
  PipeMiddleware,
} from '../types.js'
import { defineBuiltInPipeableMiddleware } from '../middleware-metadata.js'

export function persist<
  T,
  PersistedState = T,
  PersistReturn = unknown,
>(
  options: PersistOptions<T, PersistedState, PersistReturn>,
): PipeMiddleware<
  T,
  [PersistMutator],
  [PersistMutator<PersistedState>]
> {
  return defineBuiltInPipeableMiddleware(<Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
    initializer: StateCreator<T, [...Mps, PersistMutator], Mcs>,
  ) => zustandPersist(initializer, options), 'persist')
}
