import { EmptyState, Screen, ScreenTitle } from '../components/ui'
import type { ArcData } from '../state/useArc'

export default function Squad({ data }: { data: ArcData }) {
  void data
  return (
    <Screen>
      <ScreenTitle title="Squad" sub="Leaderboards, duels and streak alerts" />
      <EmptyState
        icon="🧊"
        title="Not wired up yet"
        body="Sign-in and the shared leaderboard land in the next phase. Everything you log now still counts once it does."
      />
    </Screen>
  )
}
