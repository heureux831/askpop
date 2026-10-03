const { execFileSync } = require('node:child_process')
const { join } = require('node:path')
const { existsSync } = require('node:fs')

function validateTag(tag, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || tag !== `v${version}`) {
    throw new Error('Release tag must exactly match the stable package.json version (vX.Y.Z)')
  }
}

function publishRelease({ tag, version, repo, directory = 'release-assets', run = execFileSync }) {
  validateTag(tag, version)
  if (repo !== 'heureux831/askpop') throw new Error('Unexpected release repository')
  const assets = [join(directory, `AskPop-${version}-arm64.dmg`), join(directory, 'SHA256SUMS.txt')]
  for (const asset of assets) {
    if (!existsSync(asset)) throw new Error(`Missing release asset: ${asset}`)
  }
  // A failed API request must stop publishing, not be treated as a missing release.
  const pages = JSON.parse(run('gh', ['api', `repos/${repo}/releases`, '--paginate', '--slurp'], { encoding: 'utf8' }))
  const existing = pages.flat().find((release) => release.tag_name === tag)
  if (existing && !existing.draft) throw new Error('Refusing to replace an already published release')
  if (existing) {
    run('gh', ['release', 'upload', tag, ...assets, '--repo', repo, '--clobber'], { stdio: 'inherit' })
  } else {
    run('gh', ['release', 'create', tag, ...assets, '--repo', repo, '--verify-tag', '--draft',
      '--title', `AskPop ${tag}`, '--generate-notes', '--notes',
      'Apple Silicon (arm64) build. This build is not Developer ID signed or Apple notarized. Verify SHA256SUMS.txt before installing. Quit AskPop, then replace the app in Applications.'],
    { stdio: 'inherit' })
  }
}

module.exports = { validateTag, publishRelease }
if (require.main === module) {
  if (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF_TYPE !== 'tag') {
    throw new Error('Draft publishing is only allowed for a tag push')
  }
  publishRelease({ tag: process.env.GITHUB_REF_NAME, version: require('../package.json').version,
    repo: process.env.GITHUB_REPOSITORY })
}
