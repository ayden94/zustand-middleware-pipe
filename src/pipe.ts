import { createInitialPipeBuilder } from './pipe-builder.js'
import type {
  PipeBuilder,
  StateCreatorPipeStep,
} from './types.js'

export function pipe<T>(): PipeBuilder<T>
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
  base?: unknown,
  ...wrappers: ReadonlyArray<(value: unknown) => unknown>
): unknown {
  if (arguments.length === 0) {
    return createInitialPipeBuilder<unknown>()
  }

  return wrappers.reduce((current, wrapper) => wrapper(current), base)
}

export const pipeStateCreator = pipe
