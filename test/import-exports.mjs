import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

async function readText(path) {
  return readFile(new URL(path, import.meta.url), 'utf8')
}

const packageJson = JSON.parse(await readText('../package.json'))
const indexJs = await readText('../dist/index.js')
const middlewareJs = await readText('../dist/middleware.js')
const immerJs = await readText('../dist/middleware/immer.js')
const zundoJs = await readText('../dist/middleware/zundo.js')

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

async function* walkFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      yield* walkFiles(path)
      continue
    }

    yield path
  }
}

async function assertNoExtensionlessRelativeSpecifiers() {
  const distDir = fileURLToPath(new URL('../dist/', import.meta.url))
  const extensionlessRelativeSpecifier =
    /(?:\bfrom\s*['"]|\bimport\s*\(\s*['"]|\bimport\s*['"])(\.\.?\/(?![^'"]+\.js['"])[^'"]+)(?:['"])/g

  for await (const path of walkFiles(distDir)) {
    if (!path.endsWith('.js')) {
      continue
    }

    const content = await readFile(path, 'utf8')
    const matches = [...content.matchAll(extensionlessRelativeSpecifier)]

    assert.deepEqual(
      matches.map((match) => match[1]),
      [],
      `${path} should include .js on relative specifiers for native Node ESM resolution`,
    )
  }
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

assert.match(indexJs, /export \{ pipe \} from ['"]\.\/pipe\.js['"];/)
assert.match(
  indexJs,
  /export \{ definePipeableMiddleware \} from ['"]\.\/pipeable-middleware\.js['"];/,
)
assert.match(middlewareJs, /export \{ combine \} from ['"]\.\/middleware\/combine\.js['"];/)
assert.match(
  middlewareJs,
  /export \{ definePipeableMiddleware \} from ['"]\.\/pipeable-middleware\.js['"];/,
)
assert.match(middlewareJs, /export \{ createJSONStorage \} from ['"]zustand\/middleware['"];/)
assert.match(middlewareJs, /export \{ devtools \} from ['"]\.\/middleware\/devtools\.js['"];/)
assert.match(middlewareJs, /export \{ persist \} from ['"]\.\/middleware\/persist\.js['"];/)
assert.match(middlewareJs, /export \{ redux \} from ['"]\.\/middleware\/redux\.js['"];/)
assert.match(
  middlewareJs,
  /export \{ subscribeWithSelector \} from ['"]\.\/middleware\/subscribe-with-selector\.js['"];/,
)
assert.match(immerJs, /export function immer\(\)/)
assert.match(zundoJs, /export function temporal\(/)

await assertNoExtensionlessRelativeSpecifiers()

const rootRuntimeKeys = await readRuntimeKeys('./dist/index.js')
const middlewareRuntimeKeys = await readRuntimeKeys('./dist/middleware.js')
const zundoRuntimeKeys = await readRuntimeKeys('./dist/middleware/zundo.js')

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

if (process.env.TASK14_ROOT_EXPORTS_PATH) {
  await writeFile(
    process.env.TASK14_ROOT_EXPORTS_PATH,
    `${JSON.stringify(
      { root: rootRuntimeKeys, middleware: middlewareRuntimeKeys },
      null,
      2,
    )}\n`,
  )
}
