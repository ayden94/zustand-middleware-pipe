import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { DevtoolsOptions, PersistOptions } from 'zustand/middleware'
import type { StateCreator } from 'zustand/vanilla'
import type { MutatorTuple } from './types.js'

export function withDevtools(options?: DevtoolsOptions) {
  return <
    T,
    Mps extends MutatorTuple = [],
    Mcs extends MutatorTuple = [],
    U = T,
  >(
    initializer: StateCreator<
      T,
      [...Mps, ['zustand/devtools', never]],
      Mcs,
      U
    >,
  ) => devtools(initializer, options)
}

export function withImmer() {
  return <
    T,
    Mps extends MutatorTuple = [],
    Mcs extends MutatorTuple = [],
    U = T,
  >(
    initializer: StateCreator<
      T,
      [...Mps, ['zustand/immer', never]],
      Mcs,
      U
    >,
  ) => immer(initializer)
}

export function withPersist<
  T,
  PersistedState = T,
  PersistReturn = unknown,
>(options: PersistOptions<T, PersistedState, PersistReturn>) {
  return <Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
    initializer: StateCreator<
      T,
      [...Mps, ['zustand/persist', unknown]],
      Mcs
    >,
  ) => persist(initializer, options)
}

export function withSubscribeWithSelector() {
  return <T, Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
    initializer: StateCreator<
      T,
      [...Mps, ['zustand/subscribeWithSelector', never]],
      Mcs
    >,
  ) => subscribeWithSelector(initializer)
}
