import { defineUserlandPipeableMiddleware } from './middleware-metadata.js'
import type { PipeableMiddlewareMetadata } from './types.js'

type MiddlewareFunction = (...args: never[]) => unknown

export function definePipeableMiddleware<M extends MiddlewareFunction>(
  middleware: M,
  metadata: PipeableMiddlewareMetadata,
): M {
  return defineUserlandPipeableMiddleware(middleware, metadata)
}
