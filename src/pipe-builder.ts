import type { StateCreator } from 'zustand/vanilla'
import type {
  MutatorTuple,
  PipeApply,
  PipeAnyMiddleware,
  PipeBuilder,
  PipeCompatibleAnyMiddleware,
  PipeCompatibleMiddleware,
  PipeMiddlewareOrderGuard,
  PipeMiddleware,
  PipeResolvedState,
  PipeStateCompatibility,
} from './types.js'

function extendPipeBuilder<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
>(
  apply: PipeApply<T, Required, StoreMutators>,
  middleware: PipeAnyMiddleware<Consumed, Produced> &
    PipeCompatibleAnyMiddleware<StoreMutators, Consumed, Produced> &
    PipeMiddlewareOrderGuard<StoreMutators, Produced>,
): PipeBuilder<
  T,
  [...Consumed, ...Required],
  [...Produced, ...StoreMutators]
>
function extendPipeBuilder<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
>(
  apply: PipeApply<T, Required, StoreMutators>,
  middleware: PipeMiddleware<T, Consumed, Produced> &
    PipeCompatibleMiddleware<T, StoreMutators, Consumed, Produced> &
    PipeMiddlewareOrderGuard<StoreMutators, Produced>,
): PipeBuilder<
  T,
  [...Consumed, ...Required],
  [...Produced, ...StoreMutators]
>
function extendPipeBuilder<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
>(
  apply: PipeApply<T, Required, StoreMutators>,
  middleware: PipeCompatibleAnyMiddleware<StoreMutators, Consumed, Produced> &
    PipeMiddlewareOrderGuard<StoreMutators, Produced>,
): PipeBuilder<
  T,
  [...Consumed, ...Required],
  [...Produced, ...StoreMutators]
> {
  return createPipeBuilder(
    <
      NextT = T,
      Mps extends MutatorTuple = [],
      Mcs extends MutatorTuple = [],
    >(
      initializer: StateCreator<
        NextT,
        [...Mps, ...Consumed, ...Required],
        Mcs,
        NextT
      > &
        PipeStateCompatibility<T, NextT>,
    ) =>
      middleware(
        apply<NextT, [...Mps, ...Consumed], Mcs>(initializer),
      ),
  )
}

function createPipeBuilder<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
>(
  apply: PipeApply<T, Required, StoreMutators>,
): PipeBuilder<T, Required, StoreMutators> {
  return {
    use<Consumed extends MutatorTuple, Produced extends MutatorTuple>(
      middleware: PipeMiddleware<T, Consumed, Produced> &
        PipeCompatibleMiddleware<T, StoreMutators, Consumed, Produced> &
        PipeMiddlewareOrderGuard<StoreMutators, Produced>,
    ): PipeBuilder<
      T,
      [...Consumed, ...Required],
      [...Produced, ...StoreMutators]
    > {
      return extendPipeBuilder(
        apply,
        middleware,
      )
    },
    create<NextT = T, Mcs extends MutatorTuple = []>(
      initializer: StateCreator<NextT, Required, Mcs, NextT> &
        PipeStateCompatibility<T, NextT>,
    ): StateCreator<
      PipeResolvedState<T, NextT>,
      [],
      [...StoreMutators, ...Mcs],
      PipeResolvedState<T, NextT>
    > {
      return apply<NextT, [], Mcs>(initializer)
    },
  }
}

export function createInitialPipeBuilder(): PipeBuilder<unknown> {
  return createPipeBuilder<unknown, [], []>(
    <
      NextT = unknown,
      Mps extends MutatorTuple = [],
      Mcs extends MutatorTuple = [],
    >(
      initializer: StateCreator<NextT, [...Mps], Mcs, NextT> &
        PipeStateCompatibility<unknown, NextT>,
    ): StateCreator<NextT, Mps, [...Mcs], NextT> => initializer,
  )
}
