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
  middleware: PipeCompatibleMiddleware<
    T,
    StoreMutators,
    Consumed,
    Produced
  > &
    PipeMiddlewareOrderGuard<StoreMutators, Produced>,
): PipeBuilder<
  T,
  [...Consumed, ...Required],
  [...Produced, ...StoreMutators]
> {
  return createPipeBuilder(
    <Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
      initializer: StateCreator<
        T,
        [...Mps, ...Consumed, ...Required],
        Mcs
      >,
    ) =>
      middleware(
        apply<[...Mps, ...Consumed], Mcs>(initializer),
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
    create<Mcs extends MutatorTuple = []>(
      initializer: StateCreator<T, Required, Mcs, T>,
    ): StateCreator<T, [], [...StoreMutators, ...Mcs], T> {
      return apply<[], Mcs>(initializer)
    },
  }
}

export function createInitialPipeBuilder<T>(): PipeBuilder<T> {
  return createPipeBuilder<T, [], []>(
    <Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
      initializer: StateCreator<T, [...Mps], Mcs>,
    ): StateCreator<T, Mps, [...Mcs]> => initializer,
  )
}
