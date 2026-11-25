import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, OctagonAlert } from 'lucide-react'
import { cn, uid } from '@/lib/utils'

interface Toast {
  id: string
  message: string
  kind: 'success' | 'error'
}

const ToastContext = createContext<(message: string, kind?: Toast['kind']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = uid()
    setToasts((t) => [...t.slice(-2), { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'animate-fade-up flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg',
              t.kind === 'error' ? 'border-critical/50' : 'border-border',
            )}
          >
            {t.kind === 'error' ? (
              <OctagonAlert className="size-4 text-critical" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4 text-good" aria-hidden />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
