import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { requestPersistence } from './db/schema'
import { TabBar } from './components/TabBar'
import { Spinner } from './components/ui'
import { useArcData } from './state/useArc'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import Grid from './screens/Grid'
import Stats from './screens/Stats'
import Settings from './screens/Settings'
import Contract from './screens/Contract'

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
