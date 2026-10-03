const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { validateTag, publishRelease } = require('./publish-release.cjs')

test('reject mismatched and nonstable release tags', () => {
  validateTag('v0.4.0', '0.4.0')
  for (const tag of ['v0.3.0', 'main', 'v0.4.0-rc.1', '--help']) {
    assert.throws(() => validateTag(tag, '0.4.0'))
  }
})

function fixture(t, pages, failure) {
  const directory = mkdtempSync(join(tmpdir(), 'askpop-publish-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  for (const file of ['AskPop-0.4.0-arm64.dmg', 'SHA256SUMS.txt']) writeFileSync(join(directory, file), 'fixture')
  const calls = []
  const options = { tag: 'v0.4.0', version: '0.4.0', repo: 'heureux831/askpop', directory,
    run: (command, args) => {
      calls.push([command, ...args])
      if (failure) throw new Error('API unavailable')
      return JSON.stringify(pages)
    } }
  return { options, calls }
}

test('new release is draft and requires an existing tag', (t) => {
  const { options, calls } = fixture(t, [[]])
  publishRelease(options)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[1].slice(0, 4), ['gh', 'release', 'create', 'v0.4.0'])
  assert.ok(calls[1].includes('--draft'))
  assert.ok(calls[1].includes('--verify-tag'))
})

test('rerun updates only the matching draft, even on later API pages', (t) => {
  const { options, calls } = fixture(t, [[{ tag_name: 'v0.2.0', draft: false }], [{ tag_name: 'v0.4.0', draft: true }]])
  publishRelease(options)
  assert.deepEqual(calls[1].slice(0, 4), ['gh', 'release', 'upload', 'v0.4.0'])
})

test('published release is never overwritten', (t) => {
  const { options, calls } = fixture(t, [[{ tag_name: 'v0.4.0', draft: false }]])
  assert.throws(() => publishRelease(options), /already published/)
  assert.equal(calls.length, 1)
})

test('API failure stops publishing', (t) => {
  const { options, calls } = fixture(t, [], true)
  assert.throws(() => publishRelease(options), /API unavailable/)
  assert.equal(calls.length, 1)
})
