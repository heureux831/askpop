const { spawnSync } = require('node:child_process')
const { resolve, join } = require('node:path')
const { build: { productName } } = require('../package.json')
const archDir = process.arch === 'arm64' ? 'mac-arm64' : 'mac'
const app = resolve('dist', archDir, `${productName}.app`)
const asar = join(app, 'Contents/Resources/app.asar')
const result = spawnSync(join(app, `Contents/MacOS/${productName}`), ['-e', `
  for (const name of ['ai', '@ai-sdk/openai', '@ai-sdk/anthropic']) {
    require(${JSON.stringify(asar)} + '/node_modules/' + name)
    console.log(name + ': packaged dependency OK')
  }
  const Database = require(${JSON.stringify(asar)} + '/node_modules/better-sqlite3')
  const db = new Database(':memory:')
  db.exec('CREATE TABLE package_check (value TEXT)')
  db.prepare('INSERT INTO package_check VALUES (?)').run('sqlite-ok')
  if (db.prepare('SELECT value FROM package_check').get().value !== 'sqlite-ok') throw new Error('SQLite package check failed')
  db.close()
  console.log('better-sqlite3: packaged native binding OK')
`], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'inherit' })
process.exit(result.status ?? 1)
