import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { requestPersistence } from './db/schema'
import { useArcData } from './state/useArc'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import Grid from './screens/Grid'
import Stats from './screens/Stats'
import Squad from './screens/Squad'
import Settings from './screens/Settings'
import Contract from './screens/Contract'

const TABS = [
  { to: '/', label: 'Today', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8.4 12.2l2.6 2.6 4.6-5.2' },
  { to: '/grid', label: 'Grid', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  { to: '/stats', label: 'Stats', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/squad', label: 'Squad', icon: 'M16 20v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 20v-1a3 3 0 0 0-2-2.8' },
  { to: '/settings', label: 'More', icon: 'M4 6h16M4 12h16M4 18h16' },
]

function TabBar() {
  return (
    <nav className="border-line-soft bg-ink/85 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors ${
                isActive ? 'text-ice-400' : 'text-faint'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2.2 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={t.icon} />
                </svg>
                <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Routing keeps the scroll position between tabs otherwise, which feels broken on mobile. */
function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export default function App() {
  const data = useArcData()

  useEffect(() => {
    // Journals and photos live only here, so ask Safari not to evict us.
    void requestPersistence()
  }, [])

  if (data.loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="border-line border-t-ice-400 h-7 w-7 animate-spin rounded-full border-2" />
      </div>
    )
  }

  if (!data.arc) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <ScrollReset />
      <Routes>
        <Route path="/" element={<Today data={data} />} />
        <Route path="/grid" element={<Grid data={data} />} />
        <Route path="/stats" element={<Stats data={data} />} />
        <Route path="/squad" element={<Squad data={data} />} />
        <Route path="/settings" element={<Settings data={data} />} />
        <Route path="/contract" element={<Contract data={data} />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </div>
  )
}
