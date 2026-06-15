import { createInitialPipeBuilder } from './pipe-builder.js'
import type {
  PipeBuilder,
  StateCreatorPipeStep,
} from './types.js'

export interface Pipe {
  <A>(base: A): A
  <A, B>(
    base: A,
    ab: StateCreatorPipeStep<A, B>,
  ): B
  <A, B, C>(
    base: A,
    ab: StateCreatorPipeStep<A, B>,
    bc: StateCreatorPipeStep<B, C>,
  ): C
  <A, B, C, D>(
    base: A,
    ab: StateCreatorPipeStep<A, B>,
    bc: StateCreatorPipeStep<B, C>,
    cd: StateCreatorPipeStep<C, D>,
  ): D
  <A, B, C, D, E>(
    base: A,
    ab: StateCreatorPipeStep<A, B>,
    bc: StateCreatorPipeStep<B, C>,
    cd: StateCreatorPipeStep<C, D>,
    de: StateCreatorPipeStep<D, E>,
  ): E
  <A, B, C, D, E, F>(
    base: A,
    ab: StateCreatorPipeStep<A, B>,
    bc: StateCreatorPipeStep<B, C>,
    cd: StateCreatorPipeStep<C, D>,
    de: StateCreatorPipeStep<D, E>,
    ef: StateCreatorPipeStep<E, F>,
  ): F
  <A, B, C, D, E, F, G>(
    base: A,
    ab: StateCreatorPipeStep<A, B>,
    bc: StateCreatorPipeStep<B, C>,
    cd: StateCreatorPipeStep<C, D>,
    de: StateCreatorPipeStep<D, E>,
    ef: StateCreatorPipeStep<E, F>,
    fg: StateCreatorPipeStep<F, G>,
  ): G
  <A, B, C, D, E, F, G, H>(
    base: A,
    ab: StateCreatorPipeStep<A, B>,
    bc: StateCreatorPipeStep<B, C>,
    cd: StateCreatorPipeStep<C, D>,
    de: StateCreatorPipeStep<D, E>,
    ef: StateCreatorPipeStep<E, F>,
    fg: StateCreatorPipeStep<F, G>,
    gh: StateCreatorPipeStep<G, H>,
  ): H
  readonly use: PipeBuilder<unknown>['use']
}

function pipeCore<A>(base: A): A
function pipeCore<A, B>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
): B
function pipeCore<A, B, C>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
): C
function pipeCore<A, B, C, D>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
): D
function pipeCore<A, B, C, D, E>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
  de: StateCreatorPipeStep<D, E>,
): E
function pipeCore<A, B, C, D, E, F>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
  de: StateCreatorPipeStep<D, E>,
  ef: StateCreatorPipeStep<E, F>,
): F
function pipeCore<A, B, C, D, E, F, G>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
  de: StateCreatorPipeStep<D, E>,
  ef: StateCreatorPipeStep<E, F>,
  fg: StateCreatorPipeStep<F, G>,
): G
function pipeCore<A, B, C, D, E, F, G, H>(
  base: A,
  ab: StateCreatorPipeStep<A, B>,
  bc: StateCreatorPipeStep<B, C>,
  cd: StateCreatorPipeStep<C, D>,
  de: StateCreatorPipeStep<D, E>,
  ef: StateCreatorPipeStep<E, F>,
  fg: StateCreatorPipeStep<F, G>,
  gh: StateCreatorPipeStep<G, H>,
): H
function pipeCore(
  base: unknown,
  ...wrappers: ReadonlyArray<(value: unknown) => unknown>
): unknown {
  return wrappers.reduce((current, wrapper) => wrapper(current), base)
}

function createPipe(): Pipe {
  return Object.assign(
    pipeCore,
    { use: createInitialPipeBuilder<unknown>().use },
  )
}

export const pipe = createPipe()

export const pipeStateCreator = pipe
