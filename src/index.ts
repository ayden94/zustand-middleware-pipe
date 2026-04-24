import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { DevtoolsOptions, PersistOptions } from 'zustand/middleware'
import type { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla'

export type MutatorTuple = [StoreMutatorIdentifier, unknown][]

export type StateCreatorPipeStep<Input, Output> = (stateCreator: Input) => Output

export function pipe<A>(base: A): A
export function pipe<A, B>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
): B
export function pipe<A, B, C>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
): C
export function pipe<A, B, C, D>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
): D
export function pipe<A, B, C, D, E>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
  de: StateCreatorPipeStep<D, E>,
): E
export function pipe<A, B, C, D, E, F>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
  de: StateCreatorPipeStep<D, E>,
  ef: StateCreatorPipeStep<E, F>,
): F
export function pipe<A, B, C, D, E, F, G>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
  de: StateCreatorPipeStep<D, E>,
  ef: StateCreatorPipeStep<E, F>,
  fg: StateCreatorPipeStep<F, G>,
): G
export function pipe<A, B, C, D, E, F, G, H>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
  de: StateCreatorPipeStep<D, E>,
  ef: StateCreatorPipeStep<E, F>,
  fg: StateCreatorPipeStep<F, G>,
  gh: StateCreatorPipeStep<G, H>,
): H
export function pipe(
  base: unknown,
  ...wrappers: ReadonlyArray<(value: unknown) => unknown>
): unknown {
  return wrappers.reduce((current, wrapper) => wrapper(current), base)
}

export const pipeStateCreator = pipe

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
