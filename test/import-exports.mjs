import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
