import 'zustand/middleware'
import { subscribeWithSelector as zustandSubscribeWithSelector } from 'zustand/middleware'
import type { StateCreator } from 'zustand/vanilla'
import type {
  MutatorTuple,
  PipeAnyMiddleware,
  SubscribeWithSelectorMutator,
} from '../types.js'
import { defineBuiltInPipeableMiddleware } from '../middleware-metadata.js'

export function subscribeWithSelector(): PipeAnyMiddleware<
  [SubscribeWithSelectorMutator],
  [SubscribeWithSelectorMutator]
> {
  return defineBuiltInPipeableMiddleware(<T, Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
    initializer: StateCreator<
      T,
      [...Mps, SubscribeWithSelectorMutator],
      Mcs
    >,
  ) => zustandSubscribeWithSelector(initializer), 'subscribeWithSelector')
}
