import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { requestPersistence } from './db/schema'
import { Spinner } from './components/ui'
import { useArcData } from './state/useArc'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import Grid from './screens/Grid'
import Stats from './screens/Stats'
import Settings from './screens/Settings'
import Contract from './screens/Contract'

const TABS = [
  { to: '/', label: 'Today', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8.4 12.2l2.6 2.6 4.6-5.2' },
  { to: '/grid', label: 'Grid', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  { to: '/stats', label: 'Stats', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/settings', label: 'More', icon: 'M4 6h16M4 12h16M4 18h16' },
]

/** A floating pane of frosted glass: content stays visible through it, just blurred. */
function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <div className="flex w-full max-w-[26rem] rounded-full border border-white/[0.14] bg-white/[0.06] p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.16),inset_0_-1px_0_rgb(255_255_255/0.04),0_12px_40px_rgb(0_0_0/0.45)] backdrop-blur-2xl backdrop-saturate-150">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `press flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 ${
                isActive ? 'text-fg bg-white/[0.14]' : 'text-white/55'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2.1 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={t.icon} />
                </svg>
                <span className="text-[10px] font-medium">{t.label}</span>
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
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, and an effect that
    // returns anything but a function crashes React on the next route change.
    window.scrollTo(0, 0)
  }, [pathname])
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
        <Spinner />
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
        <Route path="/settings" element={<Settings data={data} />} />
        <Route path="/contract" element={<Contract data={data} />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </div>
  )
}
