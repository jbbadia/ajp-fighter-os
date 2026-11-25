import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { bootstrap, resetStores, setStoreErrorHandler, useProfile } from '@/data'
import { markSessionExpired, restoreSession, useAuth } from '@/data/auth'
import { DATA_MODE } from '@/data/adapters'
import { setUnauthorizedHandler } from '@/data/http'
import { AppShell } from '@/components/layout/AppShell'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { SessionDialogsProvider } from '@/features/training/SessionDialogs'
import { AuthPage } from '@/features/auth/AuthPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

// Secondary screens are code-split so the first load stays light.
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const BjjPage = lazy(() => import('@/features/bjj/BjjPage').then((m) => ({ default: m.BjjPage })))
const GymPage = lazy(() => import('@/features/gym/GymPage').then((m) => ({ default: m.GymPage })))
const CardioPage = lazy(() => import('@/features/cardio/CardioPage').then((m) => ({ default: m.CardioPage })))
const RecoveryPage = lazy(() => import('@/features/health/RecoveryPage').then((m) => ({ default: m.RecoveryPage })))
const NutritionPage = lazy(() => import('@/features/nutrition/NutritionPage').then((m) => ({ default: m.NutritionPage })))
const CompetitionPage = lazy(() => import('@/features/competition/CompetitionPage').then((m) => ({ default: m.CompetitionPage })))
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })))
const HistoryPage = lazy(() => import('@/features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))

function ThemeSync() {
  const { theme } = useProfile().settings
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return null
}

function StoreErrors() {
  const toast = useToast()
  useEffect(() => setStoreErrorHandler(() => toast('No se pudieron guardar los cambios en el servidor', 'error')), [toast])
  return null
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">{children}</div>
)

/** Loads the user's data once authenticated. */
function AuthenticatedApp({ userId, userName }: { userId: string; userName: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    bootstrap(userName)
      .then(() => alive && setState('ready'))
      .catch((e) => {
        console.error(e)
        if (alive) setState('error')
      })
    return () => {
      alive = false
    }
  }, [userId, userName, attempt])

  if (state === 'loading') return <Center>Cargando AJP Fighter OS…</Center>
  if (state === 'error')
    return (
      <Center>
        No se pudieron cargar tus datos.
        <Button variant="secondary" onClick={() => { setState('loading'); setAttempt((a) => a + 1) }}>Reintentar</Button>
      </Center>
    )

  return (
    <>
      <ThemeSync />
      <StoreErrors />
      <SessionDialogsProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            {(
              [
                ['calendario', CalendarPage],
                ['bjj', BjjPage],
                ['gimnasio', GymPage],
                ['cardio', CardioPage],
                ['recuperacion', RecoveryPage],
                ['nutricion', NutritionPage],
                ['competicion', CompetitionPage],
                ['analitica', AnalyticsPage],
                ['historial', HistoryPage],
                ['perfil', ProfilePage],
              ] as const
            ).map(([path, Page]) => (
              <Route key={path} path={path} element={<Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}><Page /></Suspense>} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SessionDialogsProvider>
    </>
  )
}

export default function App() {
  const auth = useAuth()

  useEffect(() => {
    setUnauthorizedHandler(markSessionExpired)
    void restoreSession()
  }, [])

  // Drop cached data when the user logs out so another account never sees it.
  useEffect(() => {
    if (auth.status === 'anonymous') resetStores()
  }, [auth.status])

  return (
    <ToastProvider>
      {/* Base path: "/" on the Java server, "/ajp-fighter-os/" on GitHub Pages */}
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        {auth.status === 'checking' ? (
          <Center>Comprobando sesión…</Center>
        ) : auth.status === 'anonymous' ? (
          <AuthPage />
        ) : (
          <AuthenticatedApp key={auth.user.id} userId={auth.user.id} userName={DATA_MODE === 'api' ? auth.user.name : 'Deportista'} />
        )}
      </BrowserRouter>
    </ToastProvider>
  )
}
