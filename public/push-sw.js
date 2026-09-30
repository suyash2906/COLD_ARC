/*
 * Cold Arc reminders, loaded into the generated service worker (see vite.config.ts).
 *
 * The push itself carries no task data. When one arrives, this reads today's tasks from
 * the app's own IndexedDB and names the ones that are past their reminder time and still
 * undone. iOS requires every push to show a notification, so an all-clear is shown too.
 */

const DB_NAME = 'cold-arc'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME)
    // Never create the database from here: if the app has not run yet, there is nothing to read.
    req.onupgradeneeded = () => req.transaction.abort()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getAll(db, store) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const pad = (n) => String(n).padStart(2, '0')
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// Mirrors scoring.ts: has this commitment cleared its bar on a given day?
function met(c, v) {
  if (v === undefined || v === null) return false
  if (c.kind === 'bool') return v >= 1
  return c.direction === 'at_most' ? v <= c.target : v >= c.target
}

/** Tasks past their reminder time and still undone, or null when there is no arc running today. */
async function dueTasks() {
  const db = await openDb()
  try {
    const arc = (await getAll(db, 'arcs')).find((a) => a.status === 'active')
    if (!arc) return null
    const now = new Date()
    const today = isoDate(now)
    const last = isoDate(addDays(new Date(`${arc.startDate}T00:00`), arc.totalDays - 1))
    if (today < arc.startDate || today > last) return null

    const minutes = now.getHours() * 60 + now.getMinutes()
    const commitments = (await getAll(db, 'commitments'))
      .filter((c) => c.arcId === arc.id && !c.archivedAt)
      .sort((a, b) => a.order - b.order)
    const logs = new Map(
      (await getAll(db, 'logs')).filter((l) => l.arcId === arc.id).map((l) => [l.id, l.value]),
    )
    const valueOn = (c, date) => logs.get(`${c.id}:${isoDate(date)}`)

    const due = []
    for (const c of commitments) {
      if (c.remindAt === undefined || c.remindAt === null || c.remindAt > minutes) continue
      if (met(c, valueOn(c, now))) continue
      if (c.cadence === 'n_per_week') {
        // Only nag once skipping today would put the weekly quota out of reach.
        const weekday = (now.getDay() + 6) % 7
        let done = 0
        for (let i = 0; i <= weekday; i++) if (met(c, valueOn(c, addDays(now, -i)))) done++
        if (done >= c.timesPerWeek || c.timesPerWeek - done < 7 - weekday) continue
      }
      due.push(c)
    }
    return due
  } finally {
    db.close()
  }
}

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  event.waitUntil(
    (async () => {
      let due = null
      try {
        due = await dueTasks()
      } catch {
        due = null
      }

      let title
      let body
      if (due && due.length > 0) {
        const musts = due.filter((c) => c.important).length
        title = due.length === 1 ? `${due[0].label} isn't done yet` : `${due.length} still to do`
        body = due.map((c) => `${c.icon} ${c.label}`).join(' · ')
        if (musts) body += `\n${musts === 1 ? 'One is a must' : `${musts} are musts`}: miss it and you owe reps.`
      } else if (due) {
        title = 'On track 🔥'
        body = 'Everything due so far is done.'
      } else {
        title = 'Cold Arc'
        body = 'Open the app to see today.'
      }
      if (payload.test) title = `Test · ${title}`

      await self.registration.showNotification(title, {
        body,
        tag: 'cold-arc-reminder',
        renotify: true,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => 'focus' in w)
      return open ? open.focus() : self.clients.openWindow('./')
    })(),
  )
})
