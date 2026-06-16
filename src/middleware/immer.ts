import 'zustand/middleware/immer'
import { immer as zustandImmer } from 'zustand/middleware/immer'
import type { StateCreator } from 'zustand/vanilla'
import type {
  ImmerMutator,
  MutatorTuple,
  PipeAnyMiddleware,
} from '../types'
import { tagBuiltInMiddleware } from '../middleware-metadata'

export function immer(): PipeAnyMiddleware<
  [ImmerMutator],
  [ImmerMutator]
> {
  return tagBuiltInMiddleware(
    <T, Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
      initializer: StateCreator<T, [...Mps, ImmerMutator], Mcs>,
    ) => zustandImmer(initializer),
    'immer',
  )
}
