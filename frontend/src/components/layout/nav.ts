import {
  Activity,
  Apple,
  BarChart3,
  CalendarDays,
  Dumbbell,
  HandHelping,
  HeartPulse,
  History,
  LayoutDashboard,
  Swords,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/bjj', label: 'BJJ', icon: Swords },
  { to: '/gimnasio', label: 'Gimnasio', icon: Dumbbell },
  { to: '/cardio', label: 'Cardio', icon: HeartPulse },
  { to: '/recuperacion', label: 'Recuperación', icon: Activity },
  { to: '/rehab', label: 'Rehab hombro', icon: HandHelping },
  { to: '/nutricion', label: 'Nutrición', icon: Apple },
  { to: '/competicion', label: 'Competition Mode', icon: Trophy },
  { to: '/analitica', label: 'Analítica', icon: BarChart3 },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
]

/** Items pinned to the mobile bottom bar; the rest live under "Más". */
export const MOBILE_PRIMARY = ['/', '/calendario', '/bjj', '/recuperacion']
