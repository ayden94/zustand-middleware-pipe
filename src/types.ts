import type { StoreMutatorIdentifier } from 'zustand/vanilla'

type PipeMiddlewareTypeSources =
  | typeof import('zustand/middleware').devtools
  | typeof import('zustand/middleware').persist
  | typeof import('zustand/middleware').subscribeWithSelector
  | typeof import('zustand/middleware/immer').immer

type PipeMiddlewareTypesLoaded = PipeMiddlewareTypeSources extends never
  ? never
  : unknown

export type MutatorTuple = [StoreMutatorIdentifier, unknown][]

export type PipeMiddlewareName =
  | 'devtools'
  | 'immer'
  | 'persist'
  | 'subscribeWithSelector'

type PipeMiddlewareMutator<Name extends PipeMiddlewareName> =
  Name extends 'devtools'
    ? ['zustand/devtools', never]
    : Name extends 'subscribeWithSelector'
      ? ['zustand/subscribeWithSelector', never]
      : Name extends 'persist'
        ? ['zustand/persist', unknown]
        : Name extends 'immer'
          ? ['zustand/immer', never]
          : never

type IncludePipeMiddleware<
  Names extends PipeMiddlewareName,
  Name extends PipeMiddlewareName,
> = Name extends Names ? [PipeMiddlewareMutator<Name>] : []

export type PipeMiddlewareStack<
  Names extends PipeMiddlewareName = never,
> = PipeMiddlewareTypesLoaded &
  [
    ...IncludePipeMiddleware<Names, 'devtools'>,
    ...IncludePipeMiddleware<Names, 'subscribeWithSelector'>,
    ...IncludePipeMiddleware<Names, 'persist'>,
    ...IncludePipeMiddleware<Names, 'immer'>,
  ]

export type StateCreatorPipeStep<Input, Output> = (stateCreator: Input) => Output
