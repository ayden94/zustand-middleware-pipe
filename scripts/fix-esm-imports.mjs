import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = fileURLToPath(new URL('../dist/', import.meta.url))

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      yield* walk(path)
      continue
    }

    yield path
  }
}

function withJsExtension(specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return specifier
  }

  if (extname(specifier) !== '') {
    return specifier
  }

  return `${specifier}.js`
}

function rewriteRelativeSpecifiers(source) {
  return source
    .replace(
      /(\bfrom\s*['"])(\.\.?\/[^'"]+)(['"])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${withJsExtension(specifier)}${suffix}`,
    )
    .replace(
      /(\bimport\s*\(\s*['"])(\.\.?\/[^'"]+)(['"]\s*\))/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${withJsExtension(specifier)}${suffix}`,
    )
    .replace(
      /(\bimport\s*['"])(\.\.?\/[^'"]+)(['"])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${withJsExtension(specifier)}${suffix}`,
    )
}

for await (const path of walk(distDir)) {
  if (!path.endsWith('.js')) {
    continue
  }

  const source = await readFile(path, 'utf8')
  const rewritten = rewriteRelativeSpecifiers(source)

  if (rewritten !== source) {
    await writeFile(path, rewritten)
  }
}
