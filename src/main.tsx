import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
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
