import type { StateCreator } from 'zustand/vanilla'
import {
  builtInMiddlewareIds,
  getBuiltInMiddlewareKind,
  getPipeableMiddlewareMetadata,
  type BuiltInMiddlewareKind,
  type PipeableMiddlewareRuntimeMetadata,
} from './middleware-metadata.js'
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

function createDuplicatePipeableMiddlewareMessage(id: string): string {
  return `Pipeable middleware cannot be added more than once: ${id}`
}

function createPipeableMiddlewareOrderMessage(
  before: string,
  after: string,
): string {
  return `Pipeable middleware order constraint violated: ${before} must be added before ${after}`
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

function assertPipeableMiddlewareNotDuplicate(
  usedMetadata: readonly PipeableMiddlewareRuntimeMetadata[],
  nextMetadata: PipeableMiddlewareRuntimeMetadata | undefined,
): void {
  if (nextMetadata === undefined) {
    return
  }

  if (
    usedMetadata.some(
      (metadata) =>
        metadata.id === nextMetadata.id &&
        (metadata.duplicate !== 'allow' || nextMetadata.duplicate !== 'allow'),
    )
  ) {
    throw new TypeError(createDuplicatePipeableMiddlewareMessage(nextMetadata.id))
  }
}

type OrderEdge = {
  readonly before: string
  readonly after: string
}

function createPresentMiddlewareIds(
  metadata: readonly PipeableMiddlewareRuntimeMetadata[],
): Set<string> {
  return new Set(metadata.map(({ id }) => id))
}

function createPipeableOrderEdges(
  metadata: readonly PipeableMiddlewareRuntimeMetadata[],
): OrderEdge[] {
  const presentIds = createPresentMiddlewareIds(metadata)
  const edges: OrderEdge[] = []

  for (const item of metadata) {
    for (const target of item.order?.before ?? []) {
      if (presentIds.has(target)) {
        edges.push({ before: item.id, after: target })
      }
    }

    for (const target of item.order?.after ?? []) {
      if (presentIds.has(target)) {
        edges.push({ before: target, after: item.id })
      }
    }
  }

  for (const [beforeIndex, beforeKind] of builtInMiddlewareOrder.entries()) {
    const before = builtInMiddlewareIds[beforeKind]

    if (!presentIds.has(before)) {
      continue
    }

    for (const afterKind of builtInMiddlewareOrder.slice(beforeIndex + 1)) {
      const after = builtInMiddlewareIds[afterKind]

      if (presentIds.has(after)) {
        edges.push({ before, after })
      }
    }
  }

  return edges
}

function assertPipeableOrderHasNoCycle(edges: readonly OrderEdge[]): void {
  const graph = new Map<string, string[]>()
  const visiting = new Set<string>()
  const visited = new Set<string>()

  for (const { before, after } of edges) {
    graph.set(before, [...(graph.get(before) ?? []), after])
    graph.set(after, graph.get(after) ?? [])
  }

  function visit(id: string, path: readonly string[]): void {
    if (visited.has(id)) {
      return
    }

    if (visiting.has(id)) {
      throw new TypeError(
        `Pipeable middleware order metadata contains a cycle: ${[
          ...path,
          id,
        ].join(' -> ')}`,
      )
    }

    visiting.add(id)

    for (const next of graph.get(id) ?? []) {
      visit(next, [...path, id])
    }

    visiting.delete(id)
    visited.add(id)
  }

  for (const id of graph.keys()) {
    visit(id, [])
  }
}

function assertPipeableMiddlewareOrder(
  metadata: readonly PipeableMiddlewareRuntimeMetadata[],
): void {
  const edges = createPipeableOrderEdges(metadata)
  const positions = new Map(metadata.map(({ id }, index) => [id, index]))

  assertPipeableOrderHasNoCycle(edges)

  for (const { before, after } of edges) {
    const beforePosition = positions.get(before)
    const afterPosition = positions.get(after)

    if (
      beforePosition !== undefined &&
      afterPosition !== undefined &&
      beforePosition > afterPosition
    ) {
      throw new TypeError(createPipeableMiddlewareOrderMessage(before, after))
    }
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
  usedMetadata: readonly PipeableMiddlewareRuntimeMetadata[],
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
  usedMetadata: readonly PipeableMiddlewareRuntimeMetadata[],
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
  usedMetadata: readonly PipeableMiddlewareRuntimeMetadata[],
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
    usedMetadata,
  )
}

function createPipeBuilder<
  T,
  Required extends MutatorTuple,
  StoreMutators extends MutatorTuple,
>(
  apply: PipeApply<T, Required, StoreMutators>,
  usedBuiltIns: readonly BuiltInMiddlewareKind[] = [],
  usedMetadata: readonly PipeableMiddlewareRuntimeMetadata[] = [],
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
      const nextMetadata = getPipeableMiddlewareMetadata(middleware)
      const nextUsedMetadata =
        nextMetadata === undefined ? usedMetadata : [...usedMetadata, nextMetadata]

      assertBuiltInMiddlewareNotDuplicate(usedBuiltIns, nextBuiltIn)
      assertBuiltInMiddlewareOrder(usedBuiltIns, nextBuiltIn)
      assertPipeableMiddlewareNotDuplicate(usedMetadata, nextMetadata)
      assertPipeableMiddlewareOrder(nextUsedMetadata)

      return extendPipeBuilder(
        apply,
        nextBuiltIn === undefined
          ? usedBuiltIns
          : [...usedBuiltIns, nextBuiltIn],
        nextUsedMetadata,
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
