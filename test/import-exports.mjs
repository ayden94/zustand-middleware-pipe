import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
)

async function readRuntimeKeys(specifier) {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const module = await import(${JSON.stringify(specifier)}); process.stdout.write(JSON.stringify(Object.keys(module).sort()))`,
    ],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 0, result.stderr)

  return JSON.parse(result.stdout)
}

assert.deepEqual(packageJson.exports, {
  '.': {
    types: './dist/index.d.ts',
    import: './dist/index.js',
  },
  './middleware': {
    types: './dist/middleware.d.ts',
    import: './dist/middleware.js',
  },
  './middleware/immer': {
    types: './dist/middleware/immer.d.ts',
    import: './dist/middleware/immer.js',
  },
  './middleware/zundo': {
    types: './dist/middleware/zundo.d.ts',
    import: './dist/middleware/zundo.js',
  },
})

const rootRuntimeKeys = await readRuntimeKeys('zustand-middleware-pipe')
const middlewareRuntimeKeys = await readRuntimeKeys('zustand-middleware-pipe/middleware')
const immerRuntimeKeys = await readRuntimeKeys('zustand-middleware-pipe/middleware/immer')
const zundoRuntimeKeys = await readRuntimeKeys('zustand-middleware-pipe/middleware/zundo')

assert.deepEqual(rootRuntimeKeys, ['definePipeableMiddleware', 'pipe'])
assert.deepEqual(middlewareRuntimeKeys, [
  'combine',
  'createJSONStorage',
  'definePipeableMiddleware',
  'devtools',
  'persist',
  'redux',
  'subscribeWithSelector',
])
assert.deepEqual(zundoRuntimeKeys, ['temporal'])
assert.deepEqual(immerRuntimeKeys, ['immer'])

const consumerPath = fileURLToPath(new URL('./package-consumer.mts', import.meta.url))
const consumerSource = `
  import { createStore } from 'zustand/vanilla'
  import { pipe } from 'zustand-middleware-pipe'
  import { devtools, persist, subscribeWithSelector } from 'zustand-middleware-pipe/middleware'
  import { immer } from 'zustand-middleware-pipe/middleware/immer'
  import { temporal } from 'zustand-middleware-pipe/middleware/zundo'
  type State = { count: number; inc: () => void }
  const store = createStore<State>()(
    pipe
      .use(devtools({ enabled: false }))
      .use(subscribeWithSelector())
      .use(persist<State, Pick<State, 'count'>>({
        name: 'consumer',
        partialize: (state) => ({ count: state.count }),
      }))
      .use(immer())
      .create((set) => ({
        count: 0,
        inc: () => set((state) => { state.count += 1 }, false, 'counter/inc'),
      })),
  )
  store.subscribe((state) => state.count, (count) => {
    const selected: number = count
  })
  const history = createStore<State>()(
    pipe.use(temporal<State>()).create((set) => ({
      count: 0,
      inc: () => set((state) => ({ count: state.count + 1 })),
    })),
  )
  const previousCount: number | undefined =
    history.temporal.getState().pastStates[0]?.count
`

for (const [name, module, moduleResolution] of [
  ['bundler', ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
  ['NodeNext', ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
]) {
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2022,
    types: [],
    module,
    moduleResolution,
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (path, languageVersion, ...args) =>
    path === consumerPath
      ? ts.createSourceFile(path, consumerSource, languageVersion, true)
      : getSourceFile(path, languageVersion, ...args)
  const program = ts.createProgram([consumerPath], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    code: diagnostic.code,
    file: diagnostic.file?.fileName,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }))
  assert.deepEqual(diagnostics, [], `${name} must resolve the public declarations`)
  console.log(`PUBLIC_TYPES_PASS ${name}`)
}
