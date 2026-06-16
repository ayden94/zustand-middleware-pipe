import { devtools as zustandDevtools } from 'zustand/middleware'
import type { DevtoolsOptions } from 'zustand/middleware'
import type { StateCreator } from 'zustand/vanilla'
import type {
  DevtoolsMutator,
  MutatorTuple,
  PipeAnyMiddleware,
} from '../types'
import { defineBuiltInPipeableMiddleware } from '../middleware-metadata'

export function devtools(
  options?: DevtoolsOptions,
): PipeAnyMiddleware<[DevtoolsMutator], [DevtoolsMutator]> {
  return defineBuiltInPipeableMiddleware(<T, Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
    initializer: StateCreator<T, [...Mps, DevtoolsMutator], Mcs>,
  ) => zustandDevtools(initializer, options), 'devtools')
}
