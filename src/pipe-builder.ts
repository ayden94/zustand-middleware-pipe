import type { StateCreator } from 'zustand/vanilla'
import {
  getBuiltInMiddlewareKind,
  type BuiltInMiddlewareKind,
} from './middleware-metadata'
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
} from './types'

const builtInMiddlewareOrder: BuiltInMiddlewareKind[] = [
  'devtools',
  'subscribeWithSelector',
  'persist',
  'immer',
]

const builtInMiddlewareOrderMessage =
  'Built-in pipe middleware must be added from outer to inner: devtools, subscribeWithSelector, persist, immer'

function createDuplicateBuiltInMiddlewareMessage(
  kind: BuiltInMiddlewareKind,
): string {
  return `Built-in pipe middleware cannot be added more than once: ${kind}`
}

function getBuiltInMiddlewareOrderIndex(kind: BuiltInMiddlewareKind): number {
  return builtInMiddlewareOrder.indexOf(kind)
}

function assertBuiltInMiddlewareOrder(
  usedBuiltIns: readonly BuiltInMiddlewareKind[],
  nextBuiltIn: BuiltInMiddlewareKind | undefined,
): void {
  if (nextBuiltIn === undefined) {
    return
  }

  const nextOrderIndex = getBuiltInMiddlewareOrderIndex(nextBuiltIn)
  const hasLaterBuiltIn = usedBuiltIns.some(
    (kind) => getBuiltInMiddlewareOrderIndex(kind) > nextOrderIndex,
  )

  if (hasLaterBuiltIn) {
    throw new TypeError(builtInMiddlewareOrderMessage)
  }
}

function assertBuiltInMiddlewareNotDuplicate(
  usedBuiltIns: readonly BuiltInMiddlewareKind[],
  nextBuiltIn: BuiltInMiddlewareKind | undefined,
): void {
  if (nextBuiltIn === undefined) {
    return
  }

  if (usedBuiltIns.includes(nextBuiltIn)) {
    throw new TypeError(createDuplicateBuiltInMiddlewareMessage(nextBuiltIn))
  }
}

function extendPipeBuilder<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
>(
  apply: PipeApply<T, Required, StoreMutators>,
  usedBuiltIns: readonly BuiltInMiddlewareKind[],
  middleware: PipeAnyMiddleware<Consumed, Produced> &
    PipeCompatibleAnyMiddleware<Required, Consumed, Produced> &
    PipeMiddlewareOrderGuard<StoreMutators, Produced>,
): PipeBuilder<
  T,
  [...Required, ...Consumed],
  [...StoreMutators, ...Produced]
>
function extendPipeBuilder<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
>(
  apply: PipeApply<T, Required, StoreMutators>,
  usedBuiltIns: readonly BuiltInMiddlewareKind[],
  middleware: PipeMiddleware<T, Consumed, Produced> &
    PipeCompatibleMiddleware<T, Required, Consumed, Produced> &
    PipeMiddlewareOrderGuard<StoreMutators, Produced>,
): PipeBuilder<
  T,
  [...Required, ...Consumed],
  [...StoreMutators, ...Produced]
>
function extendPipeBuilder<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
>(
  apply: PipeApply<T, Required, StoreMutators>,
  usedBuiltIns: readonly BuiltInMiddlewareKind[],
  middleware: PipeCompatibleAnyMiddleware<Required, Consumed, Produced> &
    PipeMiddlewareOrderGuard<StoreMutators, Produced>,
): PipeBuilder<
  T,
  [...Required, ...Consumed],
  [...StoreMutators, ...Produced]
> {
  return createPipeBuilder(
    <
      NextT = T,
      Mps extends MutatorTuple = [],
      Mcs extends MutatorTuple = [],
    >(
      initializer: StateCreator<
        NextT,
        [...Mps, ...Required, ...Consumed],
        Mcs,
        NextT
      >,
    ) =>
      apply<NextT, Mps, [...Produced, ...Mcs]>(
        middleware<NextT, Mps, Mcs>(initializer),
      ),
    usedBuiltIns,
  )
}

function createPipeBuilder<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
>(
  apply: PipeApply<T, Required, StoreMutators>,
  usedBuiltIns: readonly BuiltInMiddlewareKind[] = [],
): PipeBuilder<T, Required, StoreMutators> {
  return {
    use<Consumed extends MutatorTuple, Produced extends MutatorTuple>(
      middleware: PipeMiddleware<T, Consumed, Produced> &
        PipeCompatibleMiddleware<T, Required, Consumed, Produced> &
        PipeMiddlewareOrderGuard<StoreMutators, Produced>,
    ): PipeBuilder<
      T,
      [...Required, ...Consumed],
      [...StoreMutators, ...Produced]
    > {
      const nextBuiltIn = getBuiltInMiddlewareKind(middleware)

      assertBuiltInMiddlewareNotDuplicate(usedBuiltIns, nextBuiltIn)
      assertBuiltInMiddlewareOrder(usedBuiltIns, nextBuiltIn)

      return extendPipeBuilder(
        apply,
        nextBuiltIn === undefined
          ? usedBuiltIns
          : [...usedBuiltIns, nextBuiltIn],
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
