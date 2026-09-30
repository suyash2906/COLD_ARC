import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
// Bundled rather than fetched from a font CDN: the app has to work offline, and it makes
// no network requests you did not ask for.
import '@fontsource-variable/geist'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Hash routing: GitHub Pages has no rewrite rules, and the URL bar is hidden
        in standalone mode anyway, so this costs nothing and removes a whole class of bug. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
