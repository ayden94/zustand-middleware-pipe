import { createInitialPipeBuilder } from './pipe-builder.js'
import type { PipeBuilder } from './types.js'

export interface Pipe {
  readonly use: PipeBuilder<unknown>['use']
}

const initialPipeBuilder = createInitialPipeBuilder()

export const pipe: Pipe = {
  use: initialPipeBuilder.use,
}
