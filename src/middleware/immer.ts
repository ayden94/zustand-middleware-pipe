import 'zustand/middleware/immer'
import { immer as zustandImmer } from 'zustand/middleware/immer'
import type { StateCreator } from 'zustand/vanilla'
import type {
  ImmerMutator,
  MutatorTuple,
  PipeAnyMiddleware,
} from '../types.js'
import { defineBuiltInPipeableMiddleware } from '../middleware-metadata.js'

export function immer(): PipeAnyMiddleware<
  [ImmerMutator],
  [ImmerMutator]
> {
  return defineBuiltInPipeableMiddleware(<T, Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
    initializer: StateCreator<T, [...Mps, ImmerMutator], Mcs>,
  ) => zustandImmer(initializer), 'immer')
}
