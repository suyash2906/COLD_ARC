/**
 * Reminders without a server of our own: a scheduled GitHub workflow sends an empty push
 * at set times, and the service worker (public/push-sw.js) looks at today's tasks on the
 * phone to decide what the notification says. No task data ever leaves the device.
 */

/** Public half of the VAPID pair; the private half lives only in the repo's secrets. */
export const VAPID_PUBLIC_KEY = 'BIkyvH868wje4u6oZtUamJkDhl0XjuXObaFqE8VIo32aDGvEBMoE-JdQunCrigFXpHQFfY-30ClHFZR6r0GJ38Q'

/** When the pushes go out, local time. Must match the cron lines in .github/workflows/reminders.yml. */
export const REMINDER_TIMES = ['7:00 pm', '8:00 pm', '9:00 pm', '10:30 pm']

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0))
}

/** iOS only offers push to apps installed on the home screen (16.4 and later). */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function enableReminders(): Promise<PushSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Turn them on in iOS Settings → Notifications → Cold Arc.'
        : 'Notifications were not allowed.',
    )
  }
  const reg = await navigator.serviceWorker.ready
  return (
    (await reg.pushManager.getSubscription()) ??
    reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
  )
}

/** A local notification, to check the phone shows them at all before the first push. */
export async function showTestNotification(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('Cold Arc', { body: 'Notifications work on this phone.', icon: 'icon-192.png' })
}
