/**
 * Score -> colour ramp. Shared by the grid, the charts and the particle field so a given
 * number always looks the same wherever it appears. Low scores stay close to the
 * background; only good days actually light up.
 */
export function scoreColor(score: number, touched = true): string {
  if (!touched && score === 0) return 'rgb(255 255 255 / 0.12)'
  if (score >= 100) return 'var(--color-ice-50)'
  if (score >= 80) return 'var(--color-ice-300)'
  if (score >= 60) return 'var(--color-ice-500)'
  if (score >= 30) return 'var(--color-ice-600)'
  if (score > 0) return '#17405f'
  return 'rgb(255 255 255 / 0.18)'
}
