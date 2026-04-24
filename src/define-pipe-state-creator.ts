import type { StateCreator } from 'zustand/vanilla'
import type { PipeMiddlewareName, PipeMiddlewareStack } from './types.js'

export function definePipeStateCreator<
  const Names extends readonly PipeMiddlewareName[],
  T,
>(
  _middlewares: Names,
  initializer: StateCreator<T, PipeMiddlewareStack<Names>, [], T>,
): StateCreator<T, PipeMiddlewareStack<Names>, [], T> {
  return initializer
}
