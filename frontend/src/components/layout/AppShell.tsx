import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProfile } from '@/data'
import { daysUntil } from '@/lib/dates'
import { Dialog } from '@/components/ui/dialog'
import { MOBILE_PRIMARY, NAV_ITEMS, type NavItem } from './nav'
import { NotificationBell } from './Notifications'

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground">
        AJP
      </div>
      <div className="leading-tight">
        <p className="font-display text-lg font-bold tracking-wide">FIGHTER OS</p>
        <p className="text-[11px] text-muted-foreground">Preparación de competición</p>
      </div>
    </div>
  )
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <item.icon className="size-4" aria-hidden />
      <span className="flex-1">{item.label}</span>
    </NavLink>
  )
}

function Sidebar() {
  const profile = useProfile()
  const days = daysUntil(profile.competition.date)
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r border-border bg-card/40 p-4 lg:flex">
      <div className="flex items-center justify-between">
        <Logo />
        <NotificationBell />
      </div>
      <nav aria-label="Principal" className="mt-8 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <SideLink key={item.to} item={item} />
        ))}
      </nav>
      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{profile.competition.name}</p>
        <p className="font-display text-2xl font-bold tabular">
          {days >= 0 ? `${days} días` : 'Finalizada'}
        </p>
        {!profile.competition.dateConfirmed && <p className="text-[11px] text-warning">Fecha estimada</p>}
      </div>
    </aside>
  )
}

function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const primary = NAV_ITEMS.filter((i) => MOBILE_PRIMARY.includes(i.to))
  const secondary = NAV_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.to))
  const moreActive = secondary.some((i) => pathname.startsWith(i.to))

  const tab = (active: boolean) =>
    cn('flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors cursor-pointer', active ? 'text-primary' : 'text-muted-foreground')

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
      >
        {primary.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => tab(isActive)}>
            <item.icon className="size-5" aria-hidden />
            {item.label === 'Dashboard' ? 'Inicio' : item.label}
          </NavLink>
        ))}
        <button type="button" className={tab(moreActive)} onClick={() => setMoreOpen(true)}>
          <MoreHorizontal className="size-5" aria-hidden />
          Más
        </button>
      </nav>
      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Más módulos">
        <div className="grid grid-cols-2 gap-2">
          {secondary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                cn('flex flex-col gap-2 rounded-xl border p-3 text-sm', isActive ? 'border-primary bg-accent' : 'border-border hover:bg-muted')
              }
            >
              <item.icon className="size-5 text-primary" aria-hidden />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </Dialog>
    </>
  )
}

export function AppShell() {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/85 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-lg lg:hidden">
          <Logo />
          <NotificationBell />
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
