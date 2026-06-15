import { createInitialPipeBuilder } from './pipe-builder.js'
import type { PipeBuilder } from './types.js'

export interface Pipe {
  readonly use: PipeBuilder<unknown>['use']
}

const initialPipeBuilder = createInitialPipeBuilder<unknown>()

export const pipe: Pipe = {
  use: initialPipeBuilder.use,
}
