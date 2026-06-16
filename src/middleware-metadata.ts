export type BuiltInMiddlewareKind =
  | 'devtools'
  | 'persist'
  | 'subscribeWithSelector'
  | 'immer'

const builtInMiddlewareKindSymbol = Symbol(
  'zustand-middleware-pipe.builtInMiddlewareKind',
)

type BuiltInMiddlewareFunction = (...args: any[]) => any

type BuiltInMiddlewareTaggedFunction = BuiltInMiddlewareFunction & {
  readonly [builtInMiddlewareKindSymbol]?: BuiltInMiddlewareKind
}

export function tagBuiltInMiddleware<M extends BuiltInMiddlewareFunction>(
  middleware: M,
  kind: BuiltInMiddlewareKind,
): M {
  Object.defineProperty(middleware, builtInMiddlewareKindSymbol, {
    value: kind,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return middleware
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
