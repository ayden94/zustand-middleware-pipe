import { createInitialPipeBuilder } from './pipe-builder'
import type { PipeBuilder } from './types'

export interface Pipe {
  readonly use: PipeBuilder<unknown>['use']
}

const initialPipeBuilder = createInitialPipeBuilder()

export const pipe: Pipe = {
  use: initialPipeBuilder.use,
}
