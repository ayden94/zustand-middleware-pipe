import type { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla'

export type MutatorTuple = [StoreMutatorIdentifier, unknown][]

export type DevtoolsMutator = ['zustand/devtools', never]
export type ImmerMutator = ['zustand/immer', never]
export type PersistMutator<PersistedState = unknown> = [
  'zustand/persist',
  PersistedState,
]
export type SubscribeWithSelectorMutator = [
  'zustand/subscribeWithSelector',
  never,
]

type PipeBuiltInMutatorId =
  | DevtoolsMutator[0]
  | ImmerMutator[0]
  | PersistMutator[0]
  | SubscribeWithSelectorMutator[0]

type PipeAllowedCurrentMutatorId<
  Id extends PipeBuiltInMutatorId,
> = Id extends DevtoolsMutator[0]
  ? PipeBuiltInMutatorId
  : Id extends SubscribeWithSelectorMutator[0]
    ? Exclude<PipeBuiltInMutatorId, DevtoolsMutator[0]>
    : Id extends PersistMutator[0]
      ? PersistMutator[0] | ImmerMutator[0]
    : ImmerMutator[0]

type PipeCanBeInnerMutator<
  Current extends [StoreMutatorIdentifier, unknown],
  ProducedId extends PipeBuiltInMutatorId,
> = Current[0] extends PipeBuiltInMutatorId
  ? ProducedId extends PipeAllowedCurrentMutatorId<Current[0]>
    ? true
    : false
  : true

type PipeCanBeInnerStack<
  CurrentStoreMutators extends MutatorTuple,
  ProducedId extends PipeBuiltInMutatorId,
> = CurrentStoreMutators extends [
  infer Current extends [StoreMutatorIdentifier, unknown],
  ...infer Rest extends MutatorTuple,
]
  ? PipeCanBeInnerMutator<Current, ProducedId> extends true
    ? PipeCanBeInnerStack<Rest, ProducedId>
    : false
  : true

type PipeCanUseProducedMutator<
  CurrentStoreMutators extends MutatorTuple,
  Produced extends [StoreMutatorIdentifier, unknown],
> = Produced[0] extends PipeBuiltInMutatorId
  ? PipeCanBeInnerStack<CurrentStoreMutators, Produced[0]>
  : true

export type PipeCanUseMiddleware<
  CurrentStoreMutators extends MutatorTuple,
  Produced extends MutatorTuple,
> = Produced extends [
  infer Current extends [StoreMutatorIdentifier, unknown],
  ...infer Rest extends MutatorTuple,
]
  ? PipeCanUseProducedMutator<
      CurrentStoreMutators,
      Current
    > extends true
    ? PipeCanUseMiddleware<CurrentStoreMutators, Rest>
    : false
  : true

export type PipeMiddlewareOrderGuard<
  CurrentStoreMutators extends MutatorTuple,
  Produced extends MutatorTuple,
> = PipeCanUseMiddleware<CurrentStoreMutators, Produced> extends true
  ? unknown
  : {
      readonly __pipeMiddlewareOrderError: 'Built-in pipe middleware must be added from outer to inner: devtools, subscribeWithSelector, persist, immer'
      readonly __pipeCurrentMutators: CurrentStoreMutators
      readonly __pipeProducedMutators: Produced
    }

export type PipeMiddleware<
  T,
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
> = <Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
  initializer: StateCreator<T, [...Mps, ...Consumed], Mcs>,
) => StateCreator<T, Mps, [...Produced, ...Mcs]>

export type PipeAnyMiddleware<
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
> = <T, Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
  initializer: StateCreator<T, [...Mps, ...Consumed], Mcs>,
) => StateCreator<T, Mps, [...Produced, ...Mcs]>

export type PipeCompatibleMiddleware<
  T,
  CurrentRequiredMutators extends MutatorTuple,
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
> = <Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
  initializer: StateCreator<
    T,
    [...Mps, ...CurrentRequiredMutators, ...Consumed],
    Mcs
  >,
) => StateCreator<T, [...Mps, ...CurrentRequiredMutators], [...Produced, ...Mcs]>

export type PipeCompatibleAnyMiddleware<
  CurrentRequiredMutators extends MutatorTuple,
  Consumed extends MutatorTuple,
  Produced extends MutatorTuple,
> = <T, Mps extends MutatorTuple = [], Mcs extends MutatorTuple = []>(
  initializer: StateCreator<
    T,
    [...Mps, ...CurrentRequiredMutators, ...Consumed],
    Mcs
  >,
) => StateCreator<T, [...Mps, ...CurrentRequiredMutators], [...Produced, ...Mcs]>

export type PipeApply<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
> = <
  NextT = T,
  Mps extends MutatorTuple = [],
  Mcs extends MutatorTuple = [],
>(
  initializer: StateCreator<NextT, [...Mps, ...Required], Mcs, NextT>,
) => StateCreator<
  PipeResolvedState<T, NextT>,
  Mps,
  [...StoreMutators, ...Mcs],
  PipeResolvedState<T, NextT>
>

export type PipeResolvedState<Current, Next> = unknown extends Current
  ? Next
  : Current

export type PipeStateCompatibility<Current, Next> = unknown extends Current
  ? unknown
  : [Next] extends [Current]
    ? unknown
    : never

export interface PipeBuilder<
  T,
  Required extends MutatorTuple = [],
  StoreMutators extends MutatorTuple = [],
> {
  use<Consumed extends MutatorTuple, Produced extends MutatorTuple>(
    middleware: PipeAnyMiddleware<Consumed, Produced> &
      PipeCompatibleAnyMiddleware<Required, Consumed, Produced> &
      PipeMiddlewareOrderGuard<StoreMutators, Produced>,
  ): PipeBuilder<
    T,
    [...Required, ...Consumed],
    [...StoreMutators, ...Produced]
  >
  use<
    NextT,
    Consumed extends MutatorTuple,
    Produced extends MutatorTuple,
  >(
    middleware: PipeMiddleware<NextT, Consumed, Produced> &
      PipeCompatibleMiddleware<NextT, Required, Consumed, Produced> &
      PipeMiddlewareOrderGuard<StoreMutators, Produced> &
      PipeStateCompatibility<T, NextT>,
  ): PipeBuilder<
    PipeResolvedState<T, NextT>,
    [...Required, ...Consumed],
    [...StoreMutators, ...Produced]
  >
  create<NextT = T, Mcs extends MutatorTuple = []>(
    initializer: StateCreator<NextT, Required, Mcs, NextT> &
      PipeStateCompatibility<T, NextT>,
  ): StateCreator<
    PipeResolvedState<T, NextT>,
    [],
    [...StoreMutators, ...Mcs],
    PipeResolvedState<T, NextT>
  >
}
