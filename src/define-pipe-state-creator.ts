import type { StateCreator } from 'zustand/vanilla'
import type { PipeMiddlewareName, PipeMiddlewareStack } from './types.js'

export function definePipeStateCreator<
  T,
  Names extends PipeMiddlewareName = never,
>(
  initializer: StateCreator<T, PipeMiddlewareStack<Names>, [], T>,
): StateCreator<T, PipeMiddlewareStack<Names>, [], T> {
  return initializer
}
