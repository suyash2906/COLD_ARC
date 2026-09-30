import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
// Bundled rather than fetched from a font CDN: the app has to work offline, and it makes
// no network requests you did not ask for.
import '@fontsource-variable/geist'
import App from './App.tsx'
import './index.css'

// An installed iPhone app resumes from memory instead of reloading, so it would never
// look for a new version on its own. Check each time it comes back to the foreground;
// autoUpdate then reloads onto the new build as soon as it has downloaded.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update()
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Hash routing: GitHub Pages has no rewrite rules, and the URL bar is hidden
        in standalone mode anyway, so this costs nothing and removes a whole class of bug. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
