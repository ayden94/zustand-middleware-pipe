import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

async function readText(path) {
  return readFile(new URL(path, import.meta.url), 'utf8')
}

async function createExtensionlessLoader() {
  const dir = await mkdtemp(join(tmpdir(), 'zustand-middleware-pipe-exports-'))
  const loaderPath = join(dir, 'loader.mjs')

  await writeFile(
    loaderPath,
    [
      "export async function resolve(specifier, context, nextResolve) {",
      "  if (specifier.startsWith('.') && !/\\.[^/]+$/.test(specifier)) {",
      "    try {",
      "      return await nextResolve(`${specifier}.js`, context)",
      '    } catch {',
      '      // Fall through to Node resolution for non-file imports.',
      '    }',
      '  }',
      '  return nextResolve(specifier, context)',
      '}',
    ].join('\n'),
  )

  return loaderPath
}

const packageJson = JSON.parse(await readText('../package.json'))
const indexJs = await readText('../dist/index.js')
const middlewareJs = await readText('../dist/middleware.js')
const immerJs = await readText('../dist/middleware/immer.js')

async function readRuntimeKeys(specifier) {
  const loaderPath = await createExtensionlessLoader()
  const result = spawnSync(
    process.execPath,
    [
      '--loader',
      loaderPath,
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
})

assert.match(indexJs, /export \{ pipe \} from ['"]\.\/pipe['"];/)
assert.match(
  indexJs,
  /export \{ definePipeableMiddleware \} from ['"]\.\/pipeable-middleware['"];/,
)
assert.match(middlewareJs, /export \{ combine \} from ['"]\.\/middleware\/combine['"];/)
assert.match(
  middlewareJs,
  /export \{ definePipeableMiddleware \} from ['"]\.\/pipeable-middleware['"];/,
)
assert.match(middlewareJs, /export \{ createJSONStorage \} from ['"]zustand\/middleware['"];/)
assert.match(middlewareJs, /export \{ devtools \} from ['"]\.\/middleware\/devtools['"];/)
assert.match(middlewareJs, /export \{ persist \} from ['"]\.\/middleware\/persist['"];/)
assert.match(middlewareJs, /export \{ redux \} from ['"]\.\/middleware\/redux['"];/)
assert.match(
  middlewareJs,
  /export \{ subscribeWithSelector \} from ['"]\.\/middleware\/subscribe-with-selector['"];/,
)
assert.match(immerJs, /export function immer\(\)/)

for (const [path, content] of [
  ['dist/index.js', indexJs],
  ['dist/middleware.js', middlewareJs],
]) {
  assert.doesNotMatch(
    content,
    /from ['"]\.\.?\/[^'"]+\.js['"]/,
    `${path} should keep extensionless relative exports for bundler resolution`,
  )
}

const rootRuntimeKeys = await readRuntimeKeys('./dist/index.js')
const middlewareRuntimeKeys = await readRuntimeKeys('./dist/middleware.js')

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
