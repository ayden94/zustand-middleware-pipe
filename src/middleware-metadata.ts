import type { PipeableMiddlewareMetadata } from './types.js'

export type BuiltInMiddlewareKind =
  | 'devtools'
  | 'persist'
  | 'subscribeWithSelector'
  | 'immer'

export type BuiltInMiddlewareId =
  | 'zustand/devtools'
  | 'zustand/persist'
  | 'zustand/subscribeWithSelector'
  | 'zustand/immer'

export type PipeableMiddlewareRuntimeMetadata = PipeableMiddlewareMetadata & {
  readonly builtInKind?: BuiltInMiddlewareKind
  readonly source: 'builtin' | 'userland'
}

export const builtInMiddlewareIds: Record<
  BuiltInMiddlewareKind,
  BuiltInMiddlewareId
> = {
  devtools: 'zustand/devtools',
  persist: 'zustand/persist',
  subscribeWithSelector: 'zustand/subscribeWithSelector',
  immer: 'zustand/immer',
}

const builtInMiddlewareKindSymbol = Symbol(
  'zustand-middleware-pipe.builtInMiddlewareKind',
)
const pipeableMiddlewareMetadataSymbol = Symbol(
  'zustand-middleware-pipe.pipeableMiddlewareMetadata',
)

type MiddlewareFunction = (...args: never[]) => unknown

type BuiltInMiddlewareTaggedFunction = MiddlewareFunction & {
  readonly [builtInMiddlewareKindSymbol]?: BuiltInMiddlewareKind
}

type PipeableMiddlewareTaggedFunction = MiddlewareFunction & {
  readonly [pipeableMiddlewareMetadataSymbol]?: PipeableMiddlewareRuntimeMetadata
}

export function isBuiltInMiddlewareId(id: string): id is BuiltInMiddlewareId {
  return Object.values<string>(builtInMiddlewareIds).includes(id)
}

function defineHiddenProperty<T extends object, K extends PropertyKey, V>(
  target: T,
  key: K,
  value: V,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: false,
    configurable: false,
    writable: false,
  })
}

export function tagPipeableMiddleware<M extends MiddlewareFunction>(
  middleware: M,
  metadata: PipeableMiddlewareRuntimeMetadata,
): M {
  defineHiddenProperty(middleware, pipeableMiddlewareMetadataSymbol, metadata)

  return middleware
}

export function getPipeableMiddlewareMetadata(
  middleware: unknown,
): PipeableMiddlewareRuntimeMetadata | undefined {
  if (typeof middleware !== 'function') {
    return undefined
  }

  return (middleware as PipeableMiddlewareTaggedFunction)[
    pipeableMiddlewareMetadataSymbol
  ]
}

export function createPublicPipeableMetadata(
  metadata: PipeableMiddlewareMetadata,
  source: PipeableMiddlewareRuntimeMetadata['source'],
  builtInKind?: BuiltInMiddlewareKind,
): PipeableMiddlewareRuntimeMetadata {
  const order: PipeableMiddlewareRuntimeMetadata['order'] = metadata.order && {
    ...(metadata.order.before && { before: [...metadata.order.before] }),
    ...(metadata.order.after && { after: [...metadata.order.after] }),
  }

  return {
    ...metadata,
    duplicate: metadata.duplicate ?? 'reject',
    source,
    ...(builtInKind && { builtInKind }),
    ...(order && { order }),
  }
}

export function assertPipeableMiddlewareCoreMetadata(
  metadata: PipeableMiddlewareMetadata,
  source: PipeableMiddlewareRuntimeMetadata['source'],
): void {
  if (source === 'userland' && isBuiltInMiddlewareId(metadata.id)) {
    throw new TypeError(
      `Pipeable middleware id conflicts with a reserved built-in id: ${metadata.id}`,
    )
  }

  for (const target of [
    ...(metadata.order?.before ?? []),
    ...(metadata.order?.after ?? []),
  ]) {
    if (target === metadata.id) {
      throw new TypeError(
        `Pipeable middleware order metadata cannot reference itself: ${metadata.id}`,
      )
    }
  }
}

export function definePipeableMiddlewareCore<M extends MiddlewareFunction>(
  middleware: M,
  metadata: PipeableMiddlewareMetadata,
  source: PipeableMiddlewareRuntimeMetadata['source'],
  builtInKind?: BuiltInMiddlewareKind,
): M {
  assertPipeableMiddlewareCoreMetadata(metadata, source)

  return tagPipeableMiddleware(
    middleware,
    createPublicPipeableMetadata(metadata, source, builtInKind),
  )
}

export function defineUserlandPipeableMiddleware<M extends MiddlewareFunction>(
  middleware: M,
  metadata: PipeableMiddlewareMetadata,
): M {
  return definePipeableMiddlewareCore(middleware, metadata, 'userland')
}

export function defineBuiltInPipeableMiddleware<M extends MiddlewareFunction>(
  middleware: M,
  kind: BuiltInMiddlewareKind,
): M {
  const definedMiddleware = definePipeableMiddlewareCore(
    middleware,
    {
      id: builtInMiddlewareIds[kind],
      duplicate: 'reject',
    },
    'builtin',
    kind,
  )

  defineHiddenProperty(definedMiddleware, builtInMiddlewareKindSymbol, kind)

  return definedMiddleware
}

export function getBuiltInMiddlewareKind(
  middleware: unknown,
): BuiltInMiddlewareKind | undefined {
  if (typeof middleware !== 'function') {
    return undefined
  }

  return (middleware as BuiltInMiddlewareTaggedFunction)[
    builtInMiddlewareKindSymbol
  ]
}
