import 'zustand/middleware'
import { subscribeWithSelector as zustandSubscribeWithSelector } from 'zustand/middleware'
import type { StateCreator } from 'zustand/vanilla'
import type {
  MutatorTuple,
  PipeAnyMiddleware,
  SubscribeWithSelectorMutator,
} from '../types'
import { tagBuiltInMiddleware } from '../middleware-metadata'

export function subscribeWithSelector(): PipeAnyMiddleware<
  [SubscribeWithSelectorMutator],
  [SubscribeWithSelectorMutator]
> {
  return tagBuiltInMiddleware(
    <T, Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
      initializer: StateCreator<
        T,
        [...Mps, SubscribeWithSelectorMutator],
        Mcs
      >,
    ) => zustandSubscribeWithSelector(initializer),
    'subscribeWithSelector',
  )
}
