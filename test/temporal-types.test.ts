import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const consumerPath = fileURLToPath(
  new URL('./temporal-consumer.ts', import.meta.url),
)

function compileConsumer(body: string) {
  const source = `
    import { createStore, type StateCreator } from 'zustand/vanilla'
    import { expectTypeOf } from 'vitest'
    import { pipe } from '../src/index'
    import { temporal } from '../src/middleware/zundo'
    type State = { count: number; label: string; inc: () => void }
    type History = Pick<State, 'count'>
    const initializer: StateCreator<State> = (set) => ({
      count: 0,
      label: 'counter',
      inc: () => set((state) => ({ count: state.count + 1 })),
    })
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

  return ts.createProgram([consumerPath], options, host)
}

function diagnosticsFor(program: ts.Program) {
  return ts.getPreEmitDiagnostics(program).map(({ code, file }) => ({
    code,
    file: file?.fileName,
  }))
}

describe('temporal history types', () => {
  it('guides bare calls without deprecating explicit or inferred state types', () => {
    // Given legacy, explicit, generic-factory and callback-inferred calls.
    const program = compileConsumer(`
      pipe.use(temporal()).create(initializer)
      temporal<State>()
      function make<T>() { return temporal<T>() }
      temporal({ partialize: (state: State) => ({ count: state.count }) })
    `)

    // When TypeScript resolves the public factory overloads.
    expect(diagnosticsFor(program)).toEqual([])
    const source = program.getSourceFile(consumerPath)
    if (!source) {
      throw new Error('The temporal consumer source was not compiled')
    }
    const tags: Array<string[] | undefined> = []
    function visit(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'temporal'
      ) {
        tags.push(
          program
            .getTypeChecker()
            .getResolvedSignature(node)
            ?.getJsDocTags()
            .map((tag) => tag.name),
        )
      }
      ts.forEachChild(node, visit)
    }
    visit(source)

    // Then only the no-state legacy overload carries editor deprecation metadata.
    expect(tags).toEqual([['deprecated'], [], [], []])
  })

  it('preserves full-state snapshots, callback types and generic factories', () => {
    // Given an explicit full-state adapter and a generic adapter factory.
    const program = compileConsumer(`
      function make<T>() { return temporal<T>() }
      const store = createStore<State>()(
        pipe.use(make<State>()).create(initializer),
      )
      const history = store.temporal.getState()
      expectTypeOf<typeof history.pastStates>().toEqualTypeOf<Partial<State>[]>()
      expectTypeOf<typeof history.futureStates>().toEqualTypeOf<Partial<State>[]>()
      const count: number | undefined = history.pastStates[0]?.count
      const action: (() => void) | undefined = history.futureStates[0]?.inc
      const callbacks = temporal<State>({
        onSave: (past, current) => {
          expectTypeOf(past).toEqualTypeOf<State>()
          expectTypeOf(current).toEqualTypeOf<State>()
        },
      })
      createStore<State>()(pipe.use(callbacks).create(initializer))
    `)

    // When the consumer accesses both history directions.
    const diagnostics = diagnosticsFor(program)

    // Then snapshots retain the upstream partial full-state contract.
    expect(diagnostics).toEqual([])
  })

  it('preserves partial history and projected callback types', () => {
    // Given explicit history projection and inference from an annotated callback.
    const program = compileConsumer(`
      const store = createStore<State>()(
        pipe.use(temporal<State, History>({
          partialize: (state) => {
            expectTypeOf(state).toEqualTypeOf<State>()
            return { count: state.count }
          },
          equality: (past, current) => {
            expectTypeOf(past).toEqualTypeOf<History>()
            return past.count === current.count
          },
          diff: (past, current) => {
            expectTypeOf(past).toEqualTypeOf<Partial<History>>()
            expectTypeOf(current).toEqualTypeOf<Partial<History>>()
            return current
          },
        })).create(initializer),
      )
      const inferred = createStore<State>()(
        pipe.use(temporal({
          partialize: (state: State) => ({ count: state.count }),
        })).create(initializer),
      )
      expectTypeOf<typeof store.temporal.getState>()
        .returns.toHaveProperty('pastStates').toEqualTypeOf<Partial<History>[]>()
      const count: number | undefined =
        inferred.temporal.getState().pastStates[0]?.count
      expectTypeOf<typeof inferred.temporal.getState>()
        .returns.toHaveProperty('futureStates').toEqualTypeOf<Partial<History>[]>()
    `)

    // When callbacks and resulting history fields are typechecked together.
    const diagnostics = diagnosticsFor(program)

    // Then projected history and callback types remain concrete.
    expect(diagnostics).toEqual([])
  })

  it('preserves full-state inference from an explicit middleware context', () => {
    // Given existing callers that annotate the middleware instead of the call.
    const program = compileConsumer(`
      const adapter: ReturnType<typeof temporal<State>> = temporal()
      const projected: ReturnType<typeof temporal<State, History>> = temporal({
        partialize: (state) => ({ count: state.count }),
      })
      const store = createStore<State>()(
        pipe.use(adapter).create(initializer),
      )
      const count: number | undefined =
        store.temporal.getState().pastStates[0]?.count
    `)

    // When the no-options call receives a concrete contextual state type.
    const diagnostics = diagnosticsFor(program)

    // Then it retains the same valid contract as an explicit type argument.
    expect(diagnostics).toEqual([])
  })

  it('rejects fields excluded from a projected history', () => {
    // Given a history projection that stores only count.
    const program = compileConsumer(`
      const store = createStore<State>()(
        pipe.use(temporal<State, History>({
          partialize: (state) => ({ count: state.count }),
        })).create(initializer),
      )
      store.temporal.getState().pastStates[0]?.inc
    `)

    // When an action excluded from the projection is accessed.
    const diagnostics = diagnosticsFor(program)

    // Then the public history type rejects the missing property.
    expect(diagnostics).toEqual([{ code: 2339, file: consumerPath }])
  })
})
