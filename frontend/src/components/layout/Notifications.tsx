import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronRight } from 'lucide-react'
import { useDailyLogs, useIntakes, useProfile, useSessions, useSupplements } from '@/data'
import { pendingItems } from '@/domain/notifications'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/misc'
import { todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'

const NOTIFIED_KEY = 'ajp-fighter-os:notified'

function usePending() {
  const sessions = useSessions()
  const logs = useDailyLogs()
  const supplements = useSupplements()
  const intakes = useIntakes()
  // Re-evaluate every minute so time-based reminders appear without reloading.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])
  void tick
  return pendingItems(sessions, logs, supplements, intakes)
}

export function NotificationBell({ className }: { className?: string }) {
  const profile = useProfile()
  const items = usePending()
  const [open, setOpen] = useState(false)
  const enabled = profile.settings.notifications

  // One system notification per day with today's pending sessions, if the user allowed it.
  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return
    const today = todayISO()
    if (localStorage.getItem(NOTIFIED_KEY) === today) return
    const sessions = items.filter((i) => i.id.startsWith('today-'))
    if (!sessions.length) return
    localStorage.setItem(NOTIFIED_KEY, today)
    new Notification('AJP Fighter OS', { body: `Hoy: ${sessions.map((s) => s.title).join(' · ')}`, icon: `${import.meta.env.BASE_URL}favicon.svg` })
  }, [enabled, items])

  if (!enabled) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Notificaciones (${items.length} pendientes)`}
        className={cn('relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer', className)}
      >
        <Bell className="size-5" />
        {items.length > 0 && (
          <span className="tabular absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Pendientes">
        {items.length === 0 ? (
          <EmptyState icon={<Bell />} title="Todo al día" description="No tienes tareas pendientes." />
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id}>
                <Link to={i.to} onClick={() => setOpen(false)} className={cn('flex items-center gap-3 rounded-lg border p-3 hover:bg-muted', i.severity === 'warning' ? 'border-warning/40' : 'border-border')}>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{i.title}</span>
                    <span className="block text-xs text-muted-foreground">{i.detail}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  )
}
