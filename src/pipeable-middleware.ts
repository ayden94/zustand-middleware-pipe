import { defineUserlandPipeableMiddleware } from './middleware-metadata'
import type { PipeableMiddlewareMetadata } from './types'

type MiddlewareFunction = (...args: never[]) => unknown

export function definePipeableMiddleware<M extends MiddlewareFunction>(
  middleware: M,
  metadata: PipeableMiddlewareMetadata,
): M {
  return defineUserlandPipeableMiddleware(middleware, metadata)
}
