import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The promise is that nothing leaves the device: no account, no server, no analytics.
 * Assert it directly — any network call added later fails the build instead of relying
 * on a code review to catch it.
 */

const SRC = join(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

// Strip comments so prose about the network does not trip the check.
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const NETWORK = [/\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bEventSource\b/, /\bsendBeacon\b/, /@supabase/, /\baxios\b/]

describe('nothing leaves the device', () => {
  const files = sourceFiles(SRC)

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const file of files) {
    it(`${relative(SRC, file)} makes no network calls`, () => {
      const src = code(readFileSync(file, 'utf8'))
      for (const pattern of NETWORK) expect(src, `${pattern}`).not.toMatch(pattern)
      // The only fetch allowed decodes a data: URL from an imported backup file.
      expect(src).not.toMatch(/\bfetch\((?!p\.dataUrl\))/)
    })
  }
})
