import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The promise is that journals and progress photos never leave the device. That is only
 * true as long as no networked module can read those tables, so assert it directly
 * rather than trusting a code review to catch it later.
 */

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8')

// Strip comments so prose about journals does not trip the check.
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const NETWORKED_MODULES = ['lib/sync.ts', 'state/useSquad.ts', 'state/useAuth.ts', 'lib/supabase.ts']
const FORBIDDEN = ['db.journals', 'db.photos', 'winOfTheDay', 'mood']

describe('device-only data', () => {
  for (const mod of NETWORKED_MODULES) {
    it(`${mod} cannot read private tables`, () => {
      const src = code(read(mod))
      for (const term of FORBIDDEN) {
        expect(src, `${mod} must not reference ${term}`).not.toContain(term)
      }
    })
  }

  it('only score-shaped columns are ever upserted', () => {
    const src = code(read('lib/sync.ts'))
    // Every table the sync module writes to must be one of the public projections.
    const tables = [...src.matchAll(/\.from\(['"]([^'"]+)['"]\)/g)].map((m) => m[1])
    expect(tables.length).toBeGreaterThan(0)
    for (const t of tables) {
      expect(['daily_scores', 'arcs_public']).toContain(t)
    }
  })

  it('the export bundle is local-only and never posted anywhere', () => {
    const src = code(read('lib/actions.ts'))
    // exportArc intentionally reads everything, so it must not be able to transmit it.
    expect(src).not.toContain('supabase')
    expect(src).not.toMatch(/\bfetch\((?!p\.dataUrl)/)
  })
})
