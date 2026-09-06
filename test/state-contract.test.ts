import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const consumerPath = fileURLToPath(
  new URL('./state-contract-consumer.ts', import.meta.url),
)

function checkConsumer(body: string) {
  const source = `
    import { createStore, type StateCreator } from 'zustand/vanilla'
    import {
      pipe,
      type PipeMiddleware,
      type PipeAnyMiddleware,
      type DevtoolsMutator,
      type ImmerMutator,
    } from '../src/index'
    import { devtools } from '../src/middleware'
    import { immer } from '../src/middleware/immer'

    type Base = { count: number }
    type Sub = Base & { label: string }
    const identity: PipeMiddleware<Base, [], []> = (initializer) => initializer
    ${body}
  `
  const options: ts.CompilerOptions = {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noEmit: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) =>
    path === consumerPath
      ? ts.createSourceFile(path, source, languageVersion, true)
      : getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile)

  const program = ts.createProgram([consumerPath], options, host)
  return ts.getPreEmitDiagnostics(program).map(({ code, file }) => ({
    code,
    file: file?.fileName,
  }))
}

describe('pipe state and mutator contracts', () => {
  it('rejects reversed built-ins inside one correctly typed compound middleware', () => {
    // Given a real wrapper whose produced tuple reverses built-in order.
    const source = `
      type Reversed = [ImmerMutator, DevtoolsMutator]
      const compound: PipeAnyMiddleware<Reversed, Reversed> = (initializer) =>
        immer()(devtools({ enabled: false })(initializer))
      pipe.use(compound)
    `

    // When the compound wrapper crosses the public use() boundary.
    const diagnostics = checkConsumer(source)

    // Then the invalid order is rejected even within a single produced tuple.
    expect(diagnostics).toEqual([{ code: 2769, file: consumerPath }])
  })

  it('preserves valid compound middleware state and setState capabilities', () => {
    // Given the matching outer-to-inner compound middleware.
    const source = `
      type Ordered = [DevtoolsMutator, ImmerMutator]
      const compound: PipeAnyMiddleware<Ordered, Ordered> = (initializer) =>
        devtools({ enabled: false })(immer()(initializer))
      const store = createStore<Base>()(
        pipe.use(compound).create(() => ({ count: 0 })),
      )
      store.setState((state) => { state.count += 1 }, false, 'counter/inc')
      const count: number = store.getState().count
    `

    // When the returned store uses draft updates and action labels together.
    const diagnostics = checkConsumer(source)

    // Then both mutator capabilities and the concrete state remain available.
    expect(diagnostics).toEqual([])
  })

  it('rejects an initializer that requires fields a selected store can replace', () => {
    // Given an initializer whose get() requires more than the selected state.
    const source = `
      let readLabel: () => string = () => ''
      const initializer: StateCreator<Sub> = (_set, get) => {
        readLabel = () => get().label.toUpperCase()
        return { count: 0, label: 'counter' }
      }
      const store = createStore(pipe.use(identity).create(initializer))
      store.setState({ count: 1 }, true)
      readLabel()
    `

    // When the consumer is compiled, reject the unsafe create() boundary.
    const diagnostics = checkConsumer(source)

    // Then legal state replacement cannot invalidate an accepted initializer.
    expect(diagnostics).toEqual([{ code: 2345, file: consumerPath }])
  })

  it('rejects a later middleware that requires a narrower selected state', () => {
    // Given middleware that requires an additional state field.
    const source = `
      const narrower: PipeMiddleware<Sub, [], []> = (initializer) => initializer
      pipe.use(identity).use(narrower)
    `

    // When the middleware is added to a builder with an established state.
    const diagnostics = checkConsumer(source)

    // Then no use() overload accepts the incompatible mutable state contract.
    expect(diagnostics).toEqual([{ code: 2769, file: consumerPath }])
  })

  it('preserves equal-state composition and state inference before selection', () => {
    // Given matching state contracts and a state-generic middleware.
    const source = `
      const initializer: StateCreator<Base> = (_set, get) => {
        const readCount: () => number = () => get().count
        return { count: 0 }
      }
      const selected = createStore(
        pipe.use(identity).use(identity).create(initializer),
      )
      selected.setState({ count: 1 }, true)
      const count: number = selected.getState().count

      const inferred = createStore(
        pipe.use(devtools({ enabled: false })).create(() => ({
          count: 0,
          label: 'counter',
        })),
      )
      const label: string = inferred.getState().label
    `

    // When valid public consumers are compiled.
    const diagnostics = checkConsumer(source)

    // Then selected and inferred states retain their concrete types.
    expect(diagnostics).toEqual([])
  })
})
