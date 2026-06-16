import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function readText(path) {
  return readFile(new URL(path, import.meta.url), 'utf8')
}

const packageJson = JSON.parse(await readText('../package.json'))
const indexJs = await readText('../dist/index.js')
const middlewareJs = await readText('../dist/middleware.js')
const immerJs = await readText('../dist/middleware/immer.js')

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
assert.match(middlewareJs, /export \{ combine \} from ['"]\.\/middleware\/combine['"];/)
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
