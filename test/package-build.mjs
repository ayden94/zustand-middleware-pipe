import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

for (const initialOutput of ['missing', 'stale']) {
  test(`npm pack rebuilds ${initialOutput} distributable entry points`, async () => {
    // Given an isolated source checkout with the current installed toolchain.
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'zustand-pipe-pack-'))
    const sourceRoot = join(temporaryRoot, 'source')
    const archiveRoot = join(temporaryRoot, 'archives')
    const unpackRoot = join(temporaryRoot, 'unpacked')

    try {
      await Promise.all(
        [sourceRoot, archiveRoot, unpackRoot].map((path) => mkdir(path)),
      )
      await Promise.all(
        [
          'package.json',
          'tsconfig.json',
          'tsconfig.build.json',
          'src',
          'docs',
          'README.md',
          'LICENSE',
        ].map((path) =>
          cp(join(projectRoot, path), join(sourceRoot, path), { recursive: true }),
        ),
      )
      await symlink(
        join(projectRoot, 'node_modules'),
        join(sourceRoot, 'node_modules'),
        'dir',
      )

      if (initialOutput === 'stale') {
        execFileSync('npm', ['run', 'build'], {
          cwd: sourceRoot,
          encoding: 'utf8',
        })
        await writeFile(
          join(sourceRoot, 'dist/index.js'),
          "throw new Error('STALE_DIST_OUTPUT')\n",
        )
      }

      // When the source is packed through npm's normal lifecycle.
      execFileSync('npm', ['pack', '--pack-destination', archiveRoot], {
        cwd: sourceRoot,
        encoding: 'utf8',
      })
      const archives = (await readdir(archiveRoot)).filter((name) =>
        name.endsWith('.tgz'),
      )
      assert.equal(archives.length, 1)
      execFileSync('tar', ['-xzf', join(archiveRoot, archives[0]), '-C', unpackRoot])

      // Then every advertised runtime and declaration entry exists in the tarball.
      const packageRoot = join(unpackRoot, 'package')
      await symlink(
        join(projectRoot, 'node_modules'),
        join(packageRoot, 'node_modules'),
        'dir',
      )
      const manifest = JSON.parse(
        await readFile(join(packageRoot, 'package.json'), 'utf8'),
      )
      for (const entry of Object.values(manifest.exports)) {
        await access(join(packageRoot, entry.types))
        const exported = await import(
          pathToFileURL(join(packageRoot, entry.import)).href
        )
        assert.ok(Object.keys(exported).length > 0)
      }
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })
}
