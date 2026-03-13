#!/usr/bin/env node

/**
 * Fetches the CodeLife exercise manifest, decrypts it,
 * and writes exercises to src/data/challenges/codelife-exercises.json
 *
 * Usage: node scripts/sync-codelife.mjs
 */

const MANIFEST_URL = 'https://dev.codelife.app/newExerciseManifest.json'
const OUTPUT = new URL('../src/data/challenges/codelife-exercises.json', import.meta.url)

function deriveKey() {
  const mediaSource = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  const appSalt = 'CodeLife'

  let sourceHash = 0
  for (let i = 0; i < mediaSource.length; i++) {
    sourceHash =
      ((sourceHash << 5) - sourceHash + mediaSource.charCodeAt(i)) & 0xffffffff
  }

  const keyMaterial = `${appSalt}${sourceHash}${mediaSource.slice(-8)}`
  return Buffer.from(keyMaterial).toString('base64').slice(0, 32)
}

function xor(text, key) {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
    )
  }
  return result
}

function decrypt(encryptedBase64) {
  const key = deriveKey()
  const latin1 = Buffer.from(encryptedBase64, 'base64').toString('latin1')
  const decoded = decodeURIComponent(escape(latin1))
  return xor(decoded, key)
}

async function main() {
  console.log('Fetching CodeLife manifest...')
  const response = await fetch(MANIFEST_URL)
  const json = await response.json()

  console.log('Decrypting...')
  const decrypted = decrypt(json.data)
  const manifest = JSON.parse(decrypted)

  const allExercises = Object.values(manifest.exercises)
  const exercises = allExercises.filter(
    ex => ex.metadata?.tags?.includes('python'),
  )
  console.log(`Found ${allExercises.length} total, kept ${exercises.length} Python exercises`)

  const { writeFileSync } = await import('fs')
  const { fileURLToPath } = await import('url')
  const outPath = fileURLToPath(OUTPUT)

  writeFileSync(outPath, JSON.stringify(exercises, null, 2))
  console.log(`Written to ${outPath}`)
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
