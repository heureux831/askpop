const { spawnSync } = require('node:child_process')
const { dirname, join } = require('node:path')

// Use the app's Node ABI so tests exercise the same native SQLite binding as Electron.
const runner = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
const result = spawnSync(require('electron'), [runner, ...process.argv.slice(2)], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit'
})
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
