import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
const zustandRange = manifest.peerDependencies.zustand
assert.match(zustandRange, /^\^\d+\.\d+\.\d+$/)
const optionalPeers = Object.entries(manifest.peerDependenciesMeta)
  .filter(([, metadata]) => metadata.optional)
  .map(([name]) => name)

let temporaryRoot
let archivePath

before(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'zustand-pipe-consumers-'))
  execFileSync('npm', ['pack', '--pack-destination', temporaryRoot], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  const archives = (await readdir(temporaryRoot)).filter((name) =>
    name.endsWith('.tgz'),
  )
  assert.equal(archives.length, 1)
  archivePath = join(temporaryRoot, archives[0])
})

after(async () => {
  if (temporaryRoot) {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

const coreRuntime = `
  import assert from 'node:assert/strict'
  import { createStore } from 'zustand/vanilla'
  import * as root from 'zustand-middleware-pipe'
  import * as middleware from 'zustand-middleware-pipe/middleware'
  assert.deepEqual(Object.keys(root).sort(), ['definePipeableMiddleware', 'pipe'])
  const stored = new Map()
  const storage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => { stored.set(key, value) },
    removeItem: (key) => { stored.delete(key) },
  }
  const store = createStore(
    root.pipe
      .use(middleware.devtools({ enabled: false }))
      .use(middleware.subscribeWithSelector())
      .use(middleware.persist({
        name: 'installed-consumer',
        storage: middleware.createJSONStorage(() => storage),
      }))
      .create((set) => ({
        count: 0,
        inc: () => set((state) => ({ count: state.count + 1 })),
      })),
  )
  const selected = []
  store.subscribe((state) => state.count, (count) => selected.push(count))
  store.getState().inc()
  assert.equal(store.getState().count, 1)
  assert.deepEqual(selected, [1])
  assert.equal(JSON.parse(stored.get('installed-consumer')).state.count, 1)
`

const optionalRuntime = `
  import { immer } from 'zustand-middleware-pipe/middleware/immer'
  import { temporal } from 'zustand-middleware-pipe/middleware/zundo'
  const draftStore = createStore(
    root.pipe.use(immer()).create((set) => ({
      count: 0,
      inc: () => set((state) => { state.count += 1 }),
    })),
  )
  draftStore.getState().inc()
  assert.equal(draftStore.getState().count, 1)
  const historyStore = createStore(
    root.pipe.use(temporal()).create(() => ({ count: 0 })),
  )
  historyStore.setState({ count: 1 })
  historyStore.temporal.getState().undo()
  assert.equal(historyStore.getState().count, 0)
`

const coreTypes = `
  import { createStore } from 'zustand/vanilla'
  import { pipe } from 'zustand-middleware-pipe'
  import { devtools, persist, subscribeWithSelector } from 'zustand-middleware-pipe/middleware'
  type State = { count: number }
  const store = createStore<State>()(
    pipe.use(devtools()).use(subscribeWithSelector())
      .use(persist<State>({ name: 'typed-consumer' }))
      .create(() => ({ count: 0 })),
  )
  const count: number = store.getState().count
  store.subscribe((state) => state.count, (selected) => {
    const value: number = selected
  })
`

const optionalTypes = `
  import { immer } from 'zustand-middleware-pipe/middleware/immer'
  import { temporal } from 'zustand-middleware-pipe/middleware/zundo'
  const draft = createStore<State>()(
    pipe.use(immer()).create(() => ({ count: 0 })),
  )
  draft.setState((state) => { state.count += 1 })
  const history = createStore<State>()(
    pipe.use(temporal<State>()).create(() => ({ count: 0 })),
  )
  const previous: number | undefined =
    history.temporal.getState().pastStates[0]?.count
`

for (const [versionName, version] of [
  ['minimum', zustandRange.slice(1)],
  ['latest', zustandRange],
]) {
  for (const withOptionalPeers of [false, true]) {
    const name = `${versionName}-${withOptionalPeers ? 'all-adapters' : 'core-only'}`
    test(`installed package supports ${name}`, async () => {
      const consumerRoot = join(temporaryRoot, name)
      await mkdir(consumerRoot)
      await writeFile(
        join(consumerRoot, 'package.json'),
        JSON.stringify({ private: true, type: 'module' }),
      )
      const peers = withOptionalPeers
        ? optionalPeers.map((peer) => `${peer}@${manifest.peerDependencies[peer]}`)
        : []
      execFileSync('npm', [
        'install', '--ignore-scripts', '--no-audit', '--no-fund',
        '--package-lock=false', archivePath, `zustand@${version}`, ...peers,
      ], { cwd: consumerRoot, encoding: 'utf8', stdio: 'pipe' })

      if (!withOptionalPeers) {
        for (const peer of optionalPeers) {
          await assert.rejects(
            access(join(consumerRoot, 'node_modules', peer)),
            { code: 'ENOENT' },
          )
        }
      }
      execFileSync(process.execPath, [
        '--input-type=module', '-e',
        coreRuntime + (withOptionalPeers ? optionalRuntime : ''),
      ], { cwd: consumerRoot, encoding: 'utf8', stdio: 'pipe' })

      const sourcePath = join(consumerRoot, 'consumer.mts')
      const source = coreTypes + (withOptionalPeers ? optionalTypes : '')
      for (const [mode, module, moduleResolution] of [
        ['bundler', ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
        ['NodeNext', ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
      ]) {
        const options = {
          strict: true, noEmit: true, skipLibCheck: false, types: [],
          target: ts.ScriptTarget.ES2022, module, moduleResolution,
        }
        const host = ts.createCompilerHost(options)
        const getSourceFile = host.getSourceFile.bind(host)
        host.getCurrentDirectory = () => consumerRoot
        host.getSourceFile = (path, languageVersion, ...args) =>
          path === sourcePath
            ? ts.createSourceFile(path, source, languageVersion, true)
            : getSourceFile(path, languageVersion, ...args)
        const program = ts.createProgram([sourcePath], options, host)
        const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
          code: diagnostic.code,
          file: diagnostic.file?.fileName,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        }))
        assert.deepEqual(diagnostics, [], `${name} ${mode} declarations`)
      }
    })
  }
}
